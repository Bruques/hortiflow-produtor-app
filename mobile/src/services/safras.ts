import apiClient from './apiClient';
import type { MinhaSafra, Safra } from '../types/safra';
import type { PapelSocio, Socio } from '../types/sociedade';

// Contrato idêntico ao já validado no web (frontend/src/services/safras.ts) — nenhum
// endpoint novo (docs/specs/mobile/03-safra.md).
export async function listarMinhasSafrasRequest(): Promise<{ safras: MinhaSafra[] }> {
  const { data } = await apiClient.get('/safras');
  return data;
}

// Task 23 (docs/specs/23-socios-por-safra.md) — sócios/percentuais passaram a ser por
// Safra, não mais herdados da Sociedade. `socios` ausente ou vazio: a safra nasce só com
// quem está criando, 100%.
export interface SocioSafraInput {
  socio_sociedade_id?: string;
  nome?: string;
  papel?: PapelSocio;
  percentual_lucro: number;
}

export async function abrirSafraRequest(
  sociedadeId: string,
  nome: string,
  observacoes?: string,
  socios?: SocioSafraInput[]
): Promise<{ safra: Safra; socios: Socio[] }> {
  const { data } = await apiClient.post(`/sociedades/${sociedadeId}/safras`, { nome, observacoes, socios });
  return data;
}

export async function listarSociosDaSafraRequest(safraId: string): Promise<{ socios: Socio[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/socios`);
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

export async function atualizarNomeRequest(safraId: string, nome: string): Promise<{ safra: Safra }> {
  const { data } = await apiClient.patch(`/safras/${safraId}/nome`, { nome });
  return data;
}
