import { enfileirar, registrarProcessador, sincronizarTudo } from './syncQueue';
import { inserirDespesaLocalPendente, removerDespesaCache, substituirDespesaLocalPorServidor } from './despesasCache';
import { marcarSugestaoConfirmadaLocalmente } from './sugestoesCache';
import { confirmarSugestaoRequest } from '../services/regrasDespesaRecorrente';
import { hojeISO } from './data';
import { AxiosError } from 'axios';
import type { DespesaLocal } from '../types/despesa';
import type { SugestaoDespesaRecorrente } from '../types/regraDespesaRecorrente';

function gerarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// "Já confirmado hoje" — a mesma regra `POR_PERIODO` foi confirmada por outro caminho (ex: uma
// confirmação online enquanto essa ainda estava na fila offline). O backend já garantiu que a
// despesa existe; não é um erro a reexibir pro sócio (docs/specs/mobile/
// 06-vendas-e-despesa-recorrente.md, "Confirmar sugestão também é offline").
function sugestaoJaConfirmada(erro: unknown): boolean {
  return erro instanceof AxiosError && erro.response?.status === 409;
}

interface PayloadConfirmarSugestao {
  localId: string;
  safraId: string;
  regraId: string;
}

// Confirmar uma sugestão do dia é, na prática, criar uma Despesa vinculada à regra — mesmo
// alto volume/uso em campo de uma Despesa lançada manualmente, então enfileira do mesmo jeito
// (spec `06`). Registrado uma vez no bootstrap do app (App.tsx), junto dos demais processadores.
export function registrarProcessadoresSugestoes(): void {
  registrarProcessador('sugestao.confirmar', async (payloadRaw) => {
    const { localId, safraId, regraId } = payloadRaw as PayloadConfirmarSugestao;
    try {
      const { despesa } = await confirmarSugestaoRequest(safraId, regraId);
      try {
        await substituirDespesaLocalPorServidor(safraId, localId, despesa);
      } catch (erroLocal) {
        console.error(
          `[sugestaoQueue] despesa da regra ${regraId} criada no servidor, mas falhou ao atualizar o cache local — removendo o registro otimista órfão (localId ${localId}):`,
          erroLocal
        );
        await removerDespesaCache(localId).catch(() => {});
      }
    } catch (erro) {
      if (sugestaoJaConfirmada(erro)) {
        console.warn(`[sugestaoQueue] regra ${regraId} já tinha sido confirmada hoje — descartando o registro otimista local`);
        await removerDespesaCache(localId).catch(() => {});
        return;
      }
      throw erro;
    }
  });
}

export async function confirmarSugestao(safraId: string, sugestao: SugestaoDespesaRecorrente): Promise<void> {
  const localId = gerarIdLocal();
  await marcarSugestaoConfirmadaLocalmente(sugestao.id);
  await enfileirar('sugestao.confirmar', { localId, safraId, regraId: sugestao.id });

  const despesaOtimista: DespesaLocal = {
    id: localId,
    socio_id: sugestao.socio_id,
    socio_nome: sugestao.socio_nome,
    tipo: sugestao.tipo_despesa,
    valor: sugestao.valor,
    data: hojeISO(),
    foto_comprovante: null,
    descricao: null,
    rateio: null,
    coberta_por_acerto: false,
    pendenteOperacao: 'criar',
    filaId: null,
    erroSincronizacao: null,
    status_pagamento: 'PAGO',
    data_vencimento: null,
    data_pagamento: hojeISO(),
  };
  await inserirDespesaLocalPendente(safraId, despesaOtimista);

  await sincronizarTudo();
}
