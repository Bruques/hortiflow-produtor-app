import apiClient from './apiClient';
import type { PeriodoFiltro, Simulacao } from '../types/simulacao';

// Contrato idêntico ao já validado no web (frontend/src/services/simulacao.ts) — nenhum
// endpoint novo (docs/specs/mobile/05-painel-e-acerto.md). Sem `buscarResumoConsolidadoRequest`:
// o resumo entre safras fica fora de escopo desta spec.
export async function buscarSimulacaoRequest(safraId: string, periodo: PeriodoFiltro): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, { params: { periodo } });
  return data;
}

export async function buscarSimulacaoPersonalizadaRequest(
  safraId: string,
  dataInicio: string,
  dataFim: string
): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, {
    params: { data_inicio: dataInicio, data_fim: dataFim },
  });
  return data;
}
