import apiClient from './apiClient';
import type { AcertoDetalhado, AcertoResumo, TipoAcerto } from '@/types/acerto';

export interface CriarAcertoInput {
  data_inicio: string;
  data_fim: string;
  tipo: TipoAcerto;
}

export async function criarAcertoRequest(safraId: string, input: CriarAcertoInput): Promise<AcertoDetalhado> {
  const { data } = await apiClient.post(`/safras/${safraId}/acertos`, input);
  return data;
}

export async function listarAcertosRequest(safraId: string): Promise<AcertoResumo[]> {
  const { data } = await apiClient.get(`/safras/${safraId}/acertos`);
  return data;
}

export async function buscarAcertoRequest(acertoId: string): Promise<AcertoDetalhado> {
  const { data } = await apiClient.get(`/acertos/${acertoId}`);
  return data;
}
