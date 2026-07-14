import apiClient from './apiClient';
import type { PapelSocio, Sociedade, Socio } from '@/types/sociedade';

export async function criarSociedadeRequest(
  nome: string
): Promise<{ sociedade: { id: string; nome: string; codigo_convite: string } }> {
  const { data } = await apiClient.post('/sociedades', { nome });
  return data;
}

export async function entrarSociedadeRequest(
  codigo_convite: string
): Promise<{ sociedade: { id: string; nome: string } }> {
  const { data } = await apiClient.post('/sociedades/entrar', { codigo_convite });
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

export interface SocioPercentualInput {
  usuario_id: string;
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
