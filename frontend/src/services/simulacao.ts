import apiClient from './apiClient';
import type { PeriodoFiltro, Simulacao } from '@/types/simulacao';

export async function buscarSimulacaoRequest(safraId: string, periodo: PeriodoFiltro): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, { params: { periodo } });
  return data;
}
