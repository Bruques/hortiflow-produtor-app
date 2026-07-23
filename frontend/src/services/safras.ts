import apiClient from './apiClient';
import type { MinhaSafra, Safra } from '@/types/safra';

export async function listarMinhasSafrasRequest(): Promise<{ safras: MinhaSafra[] }> {
  const { data } = await apiClient.get('/safras');
  return data;
}

export async function abrirSafraRequest(
  sociedadeId: string,
  nome: string,
  observacoes?: string
): Promise<{ safra: Safra }> {
  const { data } = await apiClient.post(`/sociedades/${sociedadeId}/safras`, { nome, observacoes });
  return data;
}

export async function listarSafrasRequest(sociedadeId: string): Promise<{ safras: Safra[] }> {
  const { data } = await apiClient.get(`/sociedades/${sociedadeId}/safras`);
  return data;
}

export async function encerrarSafraRequest(safraId: string): Promise<{ safra: Safra }> {
  const { data } = await apiClient.patch(`/safras/${safraId}/encerrar`);
  return data;
}

export async function obterSafraRequest(safraId: string): Promise<{ safra: Safra }> {
  const { data } = await apiClient.get(`/safras/${safraId}`);
  return data;
}

export async function atualizarObservacoesRequest(
  safraId: string,
  observacoes: string | null
): Promise<{ safra: Safra }> {
  const { data } = await apiClient.patch(`/safras/${safraId}/observacoes`, { observacoes });
  return data;
}
