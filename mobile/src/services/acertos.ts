import apiClient from './apiClient';
import type { AcertoDetalhado, AcertoResumo, TipoAcerto } from '../types/acerto';

// Contrato idêntico ao já validado no web (frontend/src/services/acertos.ts) — nenhum
// endpoint novo (docs/specs/mobile/05-painel-e-acerto.md). Criar Acerto exige conexão e nunca
// passa pela fila de sincronização genérica (mesmo critério de safras/sociedades).
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
