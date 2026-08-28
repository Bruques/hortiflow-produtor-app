import {
  atualizarPayload,
  enfileirar,
  registrarProcessador,
  removerItem,
  sincronizarTudo,
} from './syncQueue';
import {
  atualizarDespesaCache,
  atualizarStatusPagamentoCache,
  confirmarEdicaoDespesa,
  inserirDespesaLocalPendente,
  obterDespesaCachePorId,
  removerDespesaCache,
  substituirDespesaLocalPorServidor,
} from './despesasCache';
import {
  atualizarDespesaRequest,
  criarDespesaRequest,
  excluirDespesaRequest,
  marcarDespesaComoPagaRequest,
  type AtualizarDespesaInput,
  type CriarDespesaInput,
} from '../services/despesas';
import { AxiosError } from 'axios';
import type { DespesaLocal, ItemRateio } from '../types/despesa';

function gerarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Um 404 ao editar/excluir significa que a despesa não existe mais no servidor (ex: outro
// caminho já apagou ela, ou é um item preso na fila de uma sessão anterior corrompida) — não
// é uma falha passageira de rede, insistir pra sempre só deixa a fila suja pra sempre.
function despesaNaoEncontradaNoServidor(erro: unknown): boolean {
  return erro instanceof AxiosError && erro.response?.status === 404;
}

interface PayloadCriarDespesa extends CriarDespesaInput {
  localId: string;
  safraId: string;
}

interface PayloadEditarDespesa {
  safraId: string;
  despesaId: string;
  input: AtualizarDespesaInput;
}

interface PayloadExcluirDespesa {
  safraId: string;
  despesaId: string;
}

interface PayloadPagarDespesa {
  safraId: string;
  despesaId: string;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Registra como cada operação de despesa é enviada ao backend quando a fila processa —
// chamado uma vez no bootstrap do app (App.tsx), mesmo padrão descrito em
// docs/specs/mobile/00-setup-e-infra.md (`registrarProcessador`). O disparo automático ao
// reconectar (syncTrigger.ts) não precisa conhecer nada disso, só percorre o registro.
export function registrarProcessadoresDespesas(): void {
  registrarProcessador('despesa.criar', async (payloadRaw) => {
    const { localId, safraId, ...input } = payloadRaw as PayloadCriarDespesa;
    const { despesa } = await criarDespesaRequest(safraId, { ...input, idempotency_key: localId });
    // A partir daqui a despesa JÁ EXISTE no servidor — se a atualização do cache local
    // abaixo falhar por qualquer motivo, NUNCA deixar isso re-disparar um novo POST na
    // próxima tentativa (o item seria marcado 'erro' e reprocessado, criando uma despesa
    // duplicada de verdade no backend a cada retry). Por isso o erro é só logado e contido
    // aqui — o pior resultado possível vira "um registro fantasma pendente na lista", não
    // "uma despesa nova a cada sincronização".
    try {
      await substituirDespesaLocalPorServidor(safraId, localId, despesa);
    } catch (erroLocal) {
      console.error(
        `[despesasQueue] despesa ${despesa.id} criada no servidor, mas falhou ao atualizar o cache local — removendo o registro otimista órfão (localId ${localId}):`,
        erroLocal
      );
      await removerDespesaCache(localId).catch((erroLimpeza) => {
        console.error(`[despesasQueue] também falhou ao limpar o registro otimista órfão ${localId}:`, erroLimpeza);
      });
    }
  });

  registrarProcessador('despesa.editar', async (payloadRaw) => {
    const { safraId, despesaId, input } = payloadRaw as PayloadEditarDespesa;
    try {
      const { despesa } = await atualizarDespesaRequest(safraId, despesaId, input);
      try {
        await confirmarEdicaoDespesa(despesa);
      } catch (erroLocal) {
        console.error(`[despesasQueue] despesa ${despesaId} editada no servidor, mas falhou ao confirmar no cache local:`, erroLocal);
      }
    } catch (erro) {
      if (despesaNaoEncontradaNoServidor(erro)) {
        console.warn(`[despesasQueue] despesa ${despesaId} não existe mais no servidor — descartando edição pendente e o resquício local`);
        await removerDespesaCache(despesaId).catch(() => {});
        return;
      }
      throw erro;
    }
  });

  registrarProcessador('despesa.pagar', async (payloadRaw) => {
    const { safraId, despesaId } = payloadRaw as PayloadPagarDespesa;
    try {
      const { despesa } = await marcarDespesaComoPagaRequest(safraId, despesaId);
      await atualizarStatusPagamentoCache(despesaId, {
        statusPagamento: despesa.status_pagamento,
        dataPagamento: despesa.data_pagamento,
        pendenteOperacao: null,
        filaId: null,
      });
    } catch (erro) {
      if (despesaNaoEncontradaNoServidor(erro)) {
        console.warn(`[despesasQueue] despesa ${despesaId} não existe mais no servidor — descartando "marcar como pago" pendente`);
        await removerDespesaCache(despesaId).catch(() => {});
        return;
      }
      // 409 = já estava paga no servidor (ex: outro sócio marcou primeiro) — mesmo resultado
      // final que essa operação queria, só falta limpar a pendência local.
      if (erro instanceof AxiosError && erro.response?.status === 409) {
        await atualizarStatusPagamentoCache(despesaId, {
          statusPagamento: 'PAGO',
          dataPagamento: hojeISO(),
          pendenteOperacao: null,
          filaId: null,
        }).catch(() => {});
        return;
      }
      throw erro;
    }
  });

  registrarProcessador('despesa.excluir', async (payloadRaw) => {
    const { safraId, despesaId } = payloadRaw as PayloadExcluirDespesa;
    try {
      await excluirDespesaRequest(safraId, despesaId);
    } catch (erro) {
      if (despesaNaoEncontradaNoServidor(erro)) {
        // já não existe no servidor — exatamente o estado final que a exclusão queria.
        return;
      }
      throw erro;
    }
  });
}

// Monta o rateio otimista (com nome do sócio) pra exibir o badge na lista antes mesmo de
// sincronizar — o backend é quem resolve isso de verdade, mas offline não há resposta dele
// ainda pra esperar.
function montarRateioOtimista(
  input: CriarDespesaInput,
  todosSocios: { id: string; nome: string }[]
): ItemRateio[] | null {
  if (!input.rateio) return null;
  return input.rateio.map((r) => ({
    socio_id: r.socio_id,
    socio_nome: todosSocios.find((s) => s.id === r.socio_id)?.nome ?? '',
    percentual: r.percentual,
  }));
}

export async function criarDespesa(
  safraId: string,
  input: CriarDespesaInput,
  socioNome: string,
  todosSocios: { id: string; nome: string }[]
): Promise<void> {
  const localId = gerarIdLocal();
  const filaId = await enfileirar('despesa.criar', { localId, safraId, ...input });

  const statusPagamento = input.status_pagamento ?? 'PAGO';
  const despesaOtimista: DespesaLocal = {
    id: localId,
    socio_id: input.socio_id,
    socio_nome: socioNome,
    tipo: input.tipo,
    valor: String(input.valor),
    data: input.data,
    foto_comprovante: input.foto_comprovante ?? null,
    descricao: input.descricao ?? null,
    rateio: montarRateioOtimista(input, todosSocios),
    coberta_por_acerto: false,
    pendenteOperacao: 'criar',
    filaId,
    erroSincronizacao: null,
    status_pagamento: statusPagamento,
    data_vencimento: statusPagamento === 'PENDENTE' ? input.data_vencimento ?? null : null,
    data_pagamento: statusPagamento === 'PAGO' ? input.data : null,
  };
  await inserirDespesaLocalPendente(safraId, despesaOtimista);

  // Tenta enviar na hora se houver conexão — não espera o próximo evento de reconexão
  // (syncTrigger.ts só dispara na transição offline→online, não quando já estava online o
  // tempo todo). Offline, isso só falha silenciosamente e o item fica pendente na fila.
  await sincronizarTudo();
}

export async function editarDespesa(
  safraId: string,
  despesaNaTela: DespesaLocal,
  input: CriarDespesaInput,
  socioNome: string,
  todosSocios: { id: string; nome: string }[]
): Promise<void> {
  // Relê o estado atual em vez de confiar só no que a tela de lista tinha capturado — pode
  // ter mudado por baixo (ex: acabou de sincronizar) entre o toque no item e o "Salvar".
  const despesaAtual = (await obterDespesaCachePorId(despesaNaTela.id)) ?? despesaNaTela;
  const rateioOtimista = montarRateioOtimista(input, todosSocios);
  const statusPagamento = input.status_pagamento ?? 'PAGO';
  const dataVencimento = statusPagamento === 'PENDENTE' ? input.data_vencimento ?? null : null;

  if (despesaAtual.pendenteOperacao === 'criar' && despesaAtual.filaId) {
    // Nunca chegou ao servidor: só reescreve o que vai ser enviado quando a fila processar,
    // sem nenhuma chamada de rede agora (critério de aceite 9).
    await atualizarPayload(despesaAtual.filaId, {
      localId: despesaAtual.id,
      safraId,
      ...input,
    });
    await atualizarDespesaCache(despesaAtual.id, {
      socio_id: input.socio_id,
      socio_nome: socioNome,
      tipo: input.tipo,
      valor: String(input.valor),
      data: input.data,
      foto_comprovante: input.foto_comprovante ?? null,
      descricao: input.descricao ?? null,
      rateio: rateioOtimista,
      pendenteOperacao: 'criar',
      filaId: despesaAtual.filaId,
      status_pagamento: statusPagamento,
      data_vencimento: dataVencimento,
    });
    await sincronizarTudo();
    return;
  }

  // Despesa já confirmada no servidor: enfileira a edição de verdade.
  const filaId = await enfileirar('despesa.editar', {
    safraId,
    despesaId: despesaAtual.id,
    input: { ...input, rateio: input.rateio ?? null },
  });
  await atualizarDespesaCache(despesaAtual.id, {
    socio_id: input.socio_id,
    socio_nome: socioNome,
    tipo: input.tipo,
    valor: String(input.valor),
    data: input.data,
    foto_comprovante: input.foto_comprovante ?? null,
    descricao: input.descricao ?? null,
    rateio: rateioOtimista,
    pendenteOperacao: 'editar',
    filaId,
    status_pagamento: statusPagamento,
    data_vencimento: dataVencimento,
  });
  await sincronizarTudo();
}

// Marca uma despesa como paga (docs/specs/19-despesa-pendente-e-parcelamento.md). Segue o
// mesmo raciocínio de editarDespesa: se a despesa ainda nem chegou ao servidor, só reescreve
// o que vai ser enviado quando a fila processar (já nasce paga); se já está confirmada,
// enfileira a chamada de verdade e atualiza o cache local otimisticamente.
export async function marcarDespesaComoPaga(safraId: string, despesaNaTela: DespesaLocal): Promise<void> {
  const despesaAtual = (await obterDespesaCachePorId(despesaNaTela.id)) ?? despesaNaTela;
  const hoje = hojeISO();

  if (despesaAtual.pendenteOperacao === 'criar' && despesaAtual.filaId) {
    await atualizarPayload(despesaAtual.filaId, {
      localId: despesaAtual.id,
      safraId,
      socio_id: despesaAtual.socio_id,
      tipo: despesaAtual.tipo,
      valor: Number(despesaAtual.valor),
      data: despesaAtual.data,
      foto_comprovante: despesaAtual.foto_comprovante ?? undefined,
      descricao: despesaAtual.descricao ?? undefined,
      rateio: despesaAtual.rateio?.map((r) => ({ socio_id: r.socio_id, percentual: r.percentual })),
      status_pagamento: 'PAGO',
    } satisfies PayloadCriarDespesa);
    await atualizarStatusPagamentoCache(despesaAtual.id, {
      statusPagamento: 'PAGO',
      dataPagamento: hoje,
      pendenteOperacao: 'criar',
      filaId: despesaAtual.filaId,
    });
    await sincronizarTudo();
    return;
  }

  const filaId = await enfileirar('despesa.pagar', { safraId, despesaId: despesaAtual.id });
  await atualizarStatusPagamentoCache(despesaAtual.id, {
    statusPagamento: 'PAGO',
    dataPagamento: hoje,
    pendenteOperacao: 'editar',
    filaId,
  });
  await sincronizarTudo();
}

export async function excluirDespesa(safraId: string, despesaNaTela: DespesaLocal): Promise<void> {
  const despesa = (await obterDespesaCachePorId(despesaNaTela.id)) ?? despesaNaTela;

  if (despesa.pendenteOperacao === 'criar' && despesa.filaId) {
    // Nunca chegou ao servidor: cancela só localmente, sem chamar a API por algo que ela
    // nem sabe que existe (critério de aceite 9).
    await removerItem(despesa.filaId);
    await removerDespesaCache(despesa.id);
    return;
  }

  await removerDespesaCache(despesa.id);
  await enfileirar('despesa.excluir', { safraId, despesaId: despesa.id });
  await sincronizarTudo();
}
