import apiClient from './apiClient';
import type { TipoDespesa } from '../types/despesa';
import type { RegraDespesaRecorrente, SugestaoDespesaRecorrente, TipoGatilhoRegra } from '../types/regraDespesaRecorrente';
import type { Despesa } from '../types/despesa';

export interface CriarRegraInput {
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: number;
  unidade_id?: string;
  // Ausente = despesas geradas seguem o rateio padrão; definido só na criação (sem edição depois)
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

export async function listarRegrasRequest(sociedadeId: string): Promise<{ regras: RegraDespesaRecorrente[] }> {
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
