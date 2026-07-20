import apiClient from './apiClient';
import type { PapelSocio, Sociedade, Socio, SocioSemConta } from '@/types/sociedade';

export async function criarSociedadeRequest(
  nome: string
): Promise<{ sociedade: { id: string; nome: string; codigo_convite: string } }> {
  const { data } = await apiClient.post('/sociedades', { nome });
  return data;
}

export async function previewConviteRequest(
  codigo: string
): Promise<{ sociedade: { id: string; nome: string }; socios_sem_conta: SocioSemConta[] }> {
  const { data } = await apiClient.get(`/sociedades/convite/${codigo}`);
  return data;
}

export async function entrarSociedadeRequest(
  codigo_convite: string,
  vincular_socio_id?: string
): Promise<{ sociedade: { id: string; nome: string } }> {
  const { data } = await apiClient.post('/sociedades/entrar', { codigo_convite, vincular_socio_id });
  return data;
}

export async function listarSociedadesRequest(): Promise<{ sociedades: Sociedade[] }> {
  const { data } = await apiClient.get('/sociedades');
  return data;
}

export async function listarSociosRequest(sociedadeId: string): Promise<{ socios: Socio[] }> {
  const { data } = await apiClient.get(`/sociedades/${sociedadeId}/socios`);
  return data;
}

export async function criarSocioRequest(
  sociedadeId: string,
  nome: string,
  papel: PapelSocio
): Promise<{ socio: Socio }> {
  const { data } = await apiClient.post(`/sociedades/${sociedadeId}/socios`, { nome, papel });
  return data;
}

export interface SocioPercentualInput {
  id: string;
  percentual_lucro: number;
  papel: PapelSocio;
}

export async function atualizarPercentuaisRequest(
  sociedadeId: string,
  socios: SocioPercentualInput[]
): Promise<{ socios: Socio[] }> {
  const { data } = await apiClient.put(`/sociedades/${sociedadeId}/socios/percentuais`, { socios });
  return data;
}
