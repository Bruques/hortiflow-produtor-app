import apiClient from './apiClient';
import type { TipoDespesa } from '@/types/despesa';
import type {
  RegraDespesaRecorrente,
  SugestaoDespesaRecorrente,
  TipoGatilhoRegra,
} from '@/types/regraDespesaRecorrente';

export interface CriarRegraInput {
  socio_id: string;
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: number;
  unidade_id?: string;
}

export async function criarRegraRequest(
  sociedadeId: string,
  input: CriarRegraInput
): Promise<{ regra: RegraDespesaRecorrente }> {
  const { data } = await apiClient.post(`/sociedades/${sociedadeId}/regras-recorrentes`, input);
  return data;
}

export async function listarRegrasRequest(
  sociedadeId: string
): Promise<{ regras: RegraDespesaRecorrente[] }> {
  const { data } = await apiClient.get(`/sociedades/${sociedadeId}/regras-recorrentes`);
  return data;
}

export async function atualizarAtivoRequest(
  regraId: string,
  ativo: boolean
): Promise<{ regra: { id: string; ativo: boolean } }> {
  const { data } = await apiClient.patch(`/regras-recorrentes/${regraId}`, { ativo });
  return data;
}

export async function listarSugestoesRequest(
  safraId: string
): Promise<{ sugestoes: SugestaoDespesaRecorrente[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/regras-recorrentes/sugestoes`);
  return data;
}

export async function confirmarSugestaoRequest(safraId: string, regraId: string): Promise<void> {
  await apiClient.post(`/safras/${safraId}/regras-recorrentes/${regraId}/confirmar`);
}
