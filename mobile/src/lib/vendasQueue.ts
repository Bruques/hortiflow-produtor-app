import { atualizarPayload, enfileirar, registrarProcessador, removerItem, sincronizarTudo } from './syncQueue';
import {
  atualizarVendaCache,
  confirmarEdicaoVenda,
  inserirVendaLocalPendente,
  obterVendaCachePorId,
  removerVendaCache,
  substituirVendaLocalPorServidor,
} from './vendasCache';
import {
  atualizarVendaRequest,
  criarVendaRequest,
  excluirVendaRequest,
  type AtualizarVendaInput,
  type CriarVendaInput,
} from '../services/vendas';
import { AxiosError } from 'axios';
import type { VendaLocal } from '../types/venda';

function gerarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Um 404 ao editar/excluir significa que a venda não existe mais no servidor — mesmo
// raciocínio de despesasQueue.ts, não é uma falha passageira de rede.
function vendaNaoEncontradaNoServidor(erro: unknown): boolean {
  return erro instanceof AxiosError && erro.response?.status === 404;
}

// 409 ao editar/excluir uma venda já sincronizada significa que um Acerto passou a cobrir a
// data dela entre o momento em que a edição foi enfileirada (offline) e a sincronização —
// mesma regra de negócio da spec `06`/`04` web (bloqueio por Acerto). Diferente de uma falha de
// rede, insistir pra sempre não resolve: a ação já não é mais permitida, então é descartada
// (a lista volta a refletir o estado real assim que a tela relistar do servidor).
function vendaCobertaPorAcerto(erro: unknown): boolean {
  return erro instanceof AxiosError && erro.response?.status === 409;
}

interface PayloadCriarVenda extends CriarVendaInput {
  localId: string;
  safraId: string;
}

interface PayloadEditarVenda {
  safraId: string;
  vendaId: string;
  input: AtualizarVendaInput;
}

interface PayloadExcluirVenda {
  safraId: string;
  vendaId: string;
}

// Registra como cada operação de venda é enviada ao backend quando a fila processa — chamado
// uma vez no bootstrap do app (App.tsx), mesmo padrão de despesasQueue.ts
// (docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
export function registrarProcessadoresVendas(): void {
  registrarProcessador('venda.criar', async (payloadRaw) => {
    const { localId, safraId, ...input } = payloadRaw as PayloadCriarVenda;
    const { venda } = await criarVendaRequest(safraId, input);
    // Mesmo cuidado de despesasQueue.ts: a partir daqui a venda JÁ EXISTE no servidor — se a
    // atualização do cache local falhar, nunca deixar isso re-disparar um novo POST no
    // próximo retry (criaria uma venda duplicada de verdade).
    try {
      await substituirVendaLocalPorServidor(safraId, localId, venda);
    } catch (erroLocal) {
      console.error(
        `[vendasQueue] venda ${venda.id} criada no servidor, mas falhou ao atualizar o cache local — removendo o registro otimista órfão (localId ${localId}):`,
        erroLocal
      );
      await removerVendaCache(localId).catch((erroLimpeza) => {
        console.error(`[vendasQueue] também falhou ao limpar o registro otimista órfão ${localId}:`, erroLimpeza);
      });
    }
  });

  registrarProcessador('venda.editar', async (payloadRaw) => {
    const { safraId, vendaId, input } = payloadRaw as PayloadEditarVenda;
    try {
      const { venda } = await atualizarVendaRequest(safraId, vendaId, input);
      try {
        await confirmarEdicaoVenda(venda);
      } catch (erroLocal) {
        console.error(`[vendasQueue] venda ${vendaId} editada no servidor, mas falhou ao confirmar no cache local:`, erroLocal);
      }
    } catch (erro) {
      if (vendaNaoEncontradaNoServidor(erro)) {
        console.warn(`[vendasQueue] venda ${vendaId} não existe mais no servidor — descartando edição pendente e o resquício local`);
        await removerVendaCache(vendaId).catch(() => {});
        return;
      }
      if (vendaCobertaPorAcerto(erro)) {
        console.warn(`[vendasQueue] venda ${vendaId} já está coberta por um Acerto — descartando edição pendente`);
        return;
      }
      throw erro;
    }
  });

  registrarProcessador('venda.excluir', async (payloadRaw) => {
    const { safraId, vendaId } = payloadRaw as PayloadExcluirVenda;
    try {
      await excluirVendaRequest(safraId, vendaId);
    } catch (erro) {
      if (vendaNaoEncontradaNoServidor(erro)) {
        // já não existe no servidor — exatamente o estado final que a exclusão queria.
        return;
      }
      if (vendaCobertaPorAcerto(erro)) {
        console.warn(`[vendasQueue] venda ${vendaId} já está coberta por um Acerto — não pode mais ser excluída, descartando`);
        return;
      }
      throw erro;
    }
  });
}

export async function criarVenda(safraId: string, input: CriarVendaInput, unidadeNome: string): Promise<void> {
  const localId = gerarIdLocal();
  const filaId = await enfileirar('venda.criar', { localId, safraId, ...input });

  const vendaOtimista: VendaLocal = {
    id: localId,
    data: input.data,
    quantidade: String(input.quantidade),
    preco: String(input.preco),
    total: String(input.quantidade * input.preco),
    comprador: input.comprador ?? null,
    pago: input.pago ?? false,
    unidade_id: input.unidade_id,
    unidade_nome: unidadeNome,
    // As despesas geradas por regra POR_VENDA nascem no servidor — enquanto pendente, a lista
    // não promete nenhuma despesa gerada ainda (regra de negócio da spec `06`).
    regras_aplicadas: [],
    coberta_por_acerto: false,
    pendenteOperacao: 'criar',
    filaId,
    erroSincronizacao: null,
  };
  await inserirVendaLocalPendente(safraId, vendaOtimista);

  // Tenta enviar na hora se houver conexão — mesmo padrão de criarDespesa (despesasQueue.ts).
  await sincronizarTudo();
}

export async function editarVenda(
  safraId: string,
  vendaNaTela: VendaLocal,
  input: CriarVendaInput,
  unidadeNome: string
): Promise<void> {
  const vendaAtual = (await obterVendaCachePorId(vendaNaTela.id)) ?? vendaNaTela;

  if (vendaAtual.pendenteOperacao === 'criar' && vendaAtual.filaId) {
    // Nunca chegou ao servidor: só reescreve o que vai ser enviado quando a fila processar,
    // sem nenhuma chamada de rede agora (mesmo critério de editarDespesa).
    await atualizarPayload(vendaAtual.filaId, { localId: vendaAtual.id, safraId, ...input });
    await atualizarVendaCache(vendaAtual.id, {
      data: input.data,
      quantidade: String(input.quantidade),
      preco: String(input.preco),
      total: String(input.quantidade * input.preco),
      comprador: input.comprador ?? null,
      pago: input.pago ?? false,
      unidade_id: input.unidade_id,
      unidade_nome: unidadeNome,
      pendenteOperacao: 'criar',
      filaId: vendaAtual.filaId,
    });
    await sincronizarTudo();
    return;
  }

  // Venda já confirmada no servidor: enfileira a edição de verdade.
  const filaId = await enfileirar('venda.editar', {
    safraId,
    vendaId: vendaAtual.id,
    input,
  });
  await atualizarVendaCache(vendaAtual.id, {
    data: input.data,
    quantidade: String(input.quantidade),
    preco: String(input.preco),
    total: String(input.quantidade * input.preco),
    comprador: input.comprador ?? null,
    pago: input.pago ?? false,
    unidade_id: input.unidade_id,
    unidade_nome: unidadeNome,
    pendenteOperacao: 'editar',
    filaId,
  });
  await sincronizarTudo();
}

export async function excluirVenda(safraId: string, vendaNaTela: VendaLocal): Promise<void> {
  const venda = (await obterVendaCachePorId(vendaNaTela.id)) ?? vendaNaTela;

  if (venda.pendenteOperacao === 'criar' && venda.filaId) {
    // Nunca chegou ao servidor: cancela só localmente (mesmo critério de excluirDespesa).
    await removerItem(venda.filaId);
    await removerVendaCache(venda.id);
    return;
  }

  await removerVendaCache(venda.id);
  await enfileirar('venda.excluir', { safraId, vendaId: venda.id });
  await sincronizarTudo();
}
