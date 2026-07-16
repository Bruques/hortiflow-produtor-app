import apiClient from './apiClient';
import type { PeriodoFiltro, Simulacao } from '@/types/simulacao';

export async function buscarSimulacaoRequest(safraId: string, periodo: PeriodoFiltro): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, { params: { periodo } });
  return data;
}

// Período customizado (data_inicio/data_fim), já suportado pelo controller (docs/specs/
// 05-calculo-e-painel-simulacao.md) mas sem uso no frontend até agora — a tela de Acertos
// usa isso pra calcular "lucro ainda não dividido desde o último acerto".
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
