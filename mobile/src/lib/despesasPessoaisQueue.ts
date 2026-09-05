import {
  atualizarPayload,
  enfileirar,
  registrarProcessador,
  removerItem,
  sincronizarTudo,
} from './syncQueue';
import {
  atualizarDespesaPessoalCache,
  confirmarEdicaoDespesaPessoal,
  inserirDespesaPessoalLocalPendente,
  obterDespesaPessoalCachePorId,
  removerDespesaPessoalCache,
  substituirDespesaPessoalLocalPorServidor,
} from './despesasPessoaisCache';
import {
  atualizarDespesaPessoalRequest,
  criarDespesaPessoalRequest,
  excluirDespesaPessoalRequest,
  type DespesaPessoalInput,
} from '../services/despesasPessoais';
import { AxiosError } from 'axios';
import type { DespesaPessoalLocal } from '../types/despesa';

// Mesmo padrão de lib/despesasQueue.ts — `crypto.randomUUID()` não é confiável no runtime
// Hermes/React Native.
function gerarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function despesaPessoalNaoEncontradaNoServidor(erro: unknown): boolean {
  return erro instanceof AxiosError && erro.response?.status === 404;
}

interface PayloadCriarDespesaPessoal extends DespesaPessoalInput {
  localId: string;
  safraId: string;
}

interface PayloadEditarDespesaPessoal {
  despesaPessoalId: string;
  input: Partial<DespesaPessoalInput>;
}

interface PayloadExcluirDespesaPessoal {
  despesaPessoalId: string;
}

// Registra como cada operação de despesa pessoal é enviada ao backend quando a fila
// processa — chamado uma vez no bootstrap do app (App.tsx), mesmo padrão de despesasQueue.ts
// (docs/specs/mobile/07-despesa-pessoal.md).
export function registrarProcessadoresDespesasPessoais(): void {
  registrarProcessador('despesaPessoal.criar', async (payloadRaw) => {
    const { localId, safraId, ...input } = payloadRaw as PayloadCriarDespesaPessoal;
    const { despesaPessoal } = await criarDespesaPessoalRequest(safraId, input);
    // Mesmo raciocínio de despesasQueue.ts: a partir daqui já existe no servidor — uma falha
    // ao atualizar o cache local nunca pode re-disparar um novo POST no próximo retry.
    try {
      await substituirDespesaPessoalLocalPorServidor(safraId, localId, despesaPessoal);
    } catch (erroLocal) {
      console.error(
        `[despesasPessoaisQueue] despesa pessoal ${despesaPessoal.id} criada no servidor, mas falhou ao atualizar o cache local — removendo o registro otimista órfão (localId ${localId}):`,
        erroLocal
      );
      await removerDespesaPessoalCache(localId).catch((erroLimpeza) => {
        console.error(`[despesasPessoaisQueue] também falhou ao limpar o registro otimista órfão ${localId}:`, erroLimpeza);
      });
    }
  });

  registrarProcessador('despesaPessoal.editar', async (payloadRaw) => {
    const { despesaPessoalId, input } = payloadRaw as PayloadEditarDespesaPessoal;
    try {
      const { despesaPessoal } = await atualizarDespesaPessoalRequest(despesaPessoalId, input);
      try {
        await confirmarEdicaoDespesaPessoal(despesaPessoal);
      } catch (erroLocal) {
        console.error(`[despesasPessoaisQueue] despesa pessoal ${despesaPessoalId} editada no servidor, mas falhou ao confirmar no cache local:`, erroLocal);
      }
    } catch (erro) {
      if (despesaPessoalNaoEncontradaNoServidor(erro)) {
        console.warn(`[despesasPessoaisQueue] despesa pessoal ${despesaPessoalId} não existe mais no servidor — descartando edição pendente e o resquício local`);
        await removerDespesaPessoalCache(despesaPessoalId).catch(() => {});
        return;
      }
      throw erro;
    }
  });

  registrarProcessador('despesaPessoal.excluir', async (payloadRaw) => {
    const { despesaPessoalId } = payloadRaw as PayloadExcluirDespesaPessoal;
    try {
      await excluirDespesaPessoalRequest(despesaPessoalId);
    } catch (erro) {
      if (despesaPessoalNaoEncontradaNoServidor(erro)) {
        return;
      }
      throw erro;
    }
  });
}

export async function criarDespesaPessoal(safraId: string, input: DespesaPessoalInput): Promise<void> {
  const localId = gerarIdLocal();
  const filaId = await enfileirar('despesaPessoal.criar', { localId, safraId, ...input });

  const despesaOtimista: DespesaPessoalLocal = {
    id: localId,
    tipo: input.tipo,
    valor: String(input.valor),
    data: input.data,
    descricao: input.descricao ?? null,
    pendenteOperacao: 'criar',
    filaId,
    erroSincronizacao: null,
  };
  await inserirDespesaPessoalLocalPendente(safraId, despesaOtimista);

  // Tenta enviar na hora se houver conexão — mesmo raciocínio de criarDespesa
  // (despesasQueue.ts): offline, só falha silenciosamente e o item fica pendente na fila.
  await sincronizarTudo();
}

export async function editarDespesaPessoal(
  safraId: string,
  despesaNaTela: DespesaPessoalLocal,
  input: DespesaPessoalInput
): Promise<void> {
  const despesaAtual = (await obterDespesaPessoalCachePorId(despesaNaTela.id)) ?? despesaNaTela;

  if (despesaAtual.pendenteOperacao === 'criar' && despesaAtual.filaId) {
    // Nunca chegou ao servidor: só reescreve o que vai ser enviado quando a fila processar
    // (critério de aceite 4 da spec mobile 07), sem nenhuma chamada de rede agora.
    await atualizarPayload(despesaAtual.filaId, { localId: despesaAtual.id, safraId, ...input });
    await atualizarDespesaPessoalCache(despesaAtual.id, {
      tipo: input.tipo,
      valor: String(input.valor),
      data: input.data,
      descricao: input.descricao ?? null,
      pendenteOperacao: 'criar',
      filaId: despesaAtual.filaId,
    });
    await sincronizarTudo();
    return;
  }

  const filaId = await enfileirar('despesaPessoal.editar', { despesaPessoalId: despesaAtual.id, input });
  await atualizarDespesaPessoalCache(despesaAtual.id, {
    tipo: input.tipo,
    valor: String(input.valor),
    data: input.data,
    descricao: input.descricao ?? null,
    pendenteOperacao: 'editar',
    filaId,
  });
  await sincronizarTudo();
}

export async function excluirDespesaPessoal(despesaNaTela: DespesaPessoalLocal): Promise<void> {
  const despesa = (await obterDespesaPessoalCachePorId(despesaNaTela.id)) ?? despesaNaTela;

  if (despesa.pendenteOperacao === 'criar' && despesa.filaId) {
    // Nunca chegou ao servidor: cancela só localmente (critério de aceite 4).
    await removerItem(despesa.filaId);
    await removerDespesaPessoalCache(despesa.id);
    return;
  }

  await removerDespesaPessoalCache(despesa.id);
  await enfileirar('despesaPessoal.excluir', { despesaPessoalId: despesa.id });
  await sincronizarTudo();
}
