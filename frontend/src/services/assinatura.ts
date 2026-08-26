import apiClient from './apiClient';
import type { AssinaturaStatus } from '@/types/assinatura';

export async function statusAssinaturaRequest(): Promise<AssinaturaStatus> {
  const { data } = await apiClient.get<AssinaturaStatus>('/assinatura/status');
  return data;
}

export async function cancelarAssinaturaRequest(): Promise<{ dataFimAcesso: string }> {
  const { data } = await apiClient.post<{ dataFimAcesso: string }>('/assinatura/cancelar');
  return data;
}
