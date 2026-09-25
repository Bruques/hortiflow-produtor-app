import apiClient from './apiClient';
import type { TipoDespesa } from '../types/despesa';
import type { RegraDespesaRecorrente, SugestaoDespesaRecorrente, TipoGatilhoRegra } from '../types/regraDespesaRecorrente';
import type { Despesa } from '../types/despesa';

export interface CriarRegraInput {
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: number;
  unidade_id?: string;
  // Spec 30 — lavoura da regra; ausente = regra global (todas as lavouras)
  safra_id?: string;
  // Ausente = despesas geradas seguem o rateio padrão
  rateio?: { socio_id: string; percentual: number }[];
}

export interface AtualizarRegraInput {
  tipo_despesa: TipoDespesa;
  valor: number;
  unidade_id?: string;
  // Ausente = remove o rateio personalizado, volta a seguir o rateio padrão (docs/specs/04, adendo 2026-08-04)
  rateio?: { socio_id: string; percentual: number }[];
}

// Criar/editar regra recorrente exige conexão — ação rara, restrita a FINANCIADOR/MISTO
// (docs/specs/mobile/06-vendas-e-despesa-recorrente.md) — não entra na fila offline.
export async function criarRegraRequest(
  sociedadeId: string,
  input: CriarRegraInput
): Promise<{ regra: RegraDespesaRecorrente }> {
  const { data } = await apiClient.post(`/sociedades/${sociedadeId}/regras-recorrentes`, input);
  return data;
}

export async function atualizarRegraRequest(
  regraId: string,
  input: AtualizarRegraInput
): Promise<{ regra: RegraDespesaRecorrente }> {
  const { data } = await apiClient.put(`/regras-recorrentes/${regraId}`, input);
  return data;
}

// Com `safraId`, devolve só as regras dessa lavoura + as globais (spec 30)
export async function excluirRegraRequest(regraId: string): Promise<void> {
  await apiClient.delete(`/regras-recorrentes/${regraId}`);
}

export async function listarRegrasRequest(
  sociedadeId: string,
  safraId?: string
): Promise<{ regras: RegraDespesaRecorrente[] }> {
  const { data } = await apiClient.get(`/sociedades/${sociedadeId}/regras-recorrentes`, {
    params: safraId ? { safra_id: safraId } : undefined,
  });
  return data;
}

export async function atualizarAtivoRequest(
  regraId: string,
  ativo: boolean
): Promise<{ regra: { id: string; ativo: boolean } }> {
  const { data } = await apiClient.patch(`/regras-recorrentes/${regraId}`, { ativo });
  return data;
}

export async function listarSugestoesRequest(safraId: string): Promise<{ sugestoes: SugestaoDespesaRecorrente[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/regras-recorrentes/sugestoes`);
  return data;
}

// Diferente do web (que ignora o corpo da resposta): confirmar uma sugestão offline precisa
// da despesa criada pra reconciliar o cache local (mobile/src/lib/sugestaoQueue.ts) — por isso
// aqui devolve `{ despesa }`, igual ao que o backend já retorna (201).
export async function confirmarSugestaoRequest(safraId: string, regraId: string): Promise<{ despesa: Despesa }> {
  const { data } = await apiClient.post(`/safras/${safraId}/regras-recorrentes/${regraId}/confirmar`);
  return data;
}
