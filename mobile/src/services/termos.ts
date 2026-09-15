import apiClient from './apiClient';

export interface StatusTermos {
  pendente: boolean;
  versaoTermosAtual: string;
  versaoPrivacidadeAtual: string;
}

export async function statusTermosRequest(): Promise<StatusTermos> {
  const { data } = await apiClient.get<StatusTermos>('/termos/status');
  return data;
}

export async function aceitarTermosRequest(): Promise<void> {
  await apiClient.post('/termos/aceite');
}
