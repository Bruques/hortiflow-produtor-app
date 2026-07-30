import apiClient from './apiClient';
import type { Despesa, TipoDespesa } from '@/types/despesa';
import type { PeriodoFiltro } from '@/types/simulacao';

export interface FiltroDespesas {
  periodo?: PeriodoFiltro;
  data_inicio?: string;
  data_fim?: string;
}

export interface RateioInput {
  socio_id: string;
  percentual: number;
}

export interface CriarDespesaInput {
  socio_id: string;
  tipo: TipoDespesa;
  valor: number;
  data: string;
  foto_comprovante?: string;
  descricao?: string;
  // Ausente = rateio padrão (segue o percentual de lucro)
  rateio?: RateioInput[];
}

export async function criarDespesaRequest(
  safraId: string,
  input: CriarDespesaInput
): Promise<{ despesa: Despesa }> {
  const { data } = await apiClient.post(`/safras/${safraId}/despesas`, input);
  return data;
}

export async function listarDespesasRequest(
  safraId: string,
  filtro?: FiltroDespesas
): Promise<{ despesas: Despesa[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/despesas`, { params: filtro });
  return data;
}

// `rateio: null` explícito remove o rateio customizado (volta ao padrão); omitido não mexe
// no rateio atual — distinção que Partial<CriarDespesaInput> sozinho não conseguiria expressar.
export type AtualizarDespesaInput = Partial<Omit<CriarDespesaInput, 'rateio'>> & { rateio?: RateioInput[] | null };

export async function atualizarDespesaRequest(
  safraId: string,
  despesaId: string,
  input: AtualizarDespesaInput
): Promise<{ despesa: Despesa }> {
  const { data } = await apiClient.put(`/safras/${safraId}/despesas/${despesaId}`, input);
  return data;
}

export async function excluirDespesaRequest(safraId: string, despesaId: string): Promise<void> {
  await apiClient.delete(`/safras/${safraId}/despesas/${despesaId}`);
}

export type RateioCompartilhado =
  | { modo: 'igual' }
  | { modo: 'percentual'; percentuais: { safra_id: string; percentual: number }[] };

export interface CriarDespesaCompartilhadaInput {
  safra_ids: string[];
  tipo: TipoDespesa;
  valor_total: number;
  data: string;
  descricao?: string;
  foto_comprovante?: string;
  rateio: RateioCompartilhado;
}

// Lança a mesma despesa (já rateada) em várias safras de uma vez — caso de um financiador
// com uma Sociedade por meeiro e um custo genuinamente compartilhado entre eles (docs/specs/
// 11-resumo-consolidado-e-despesa-compartilhada.md).
export async function criarDespesaCompartilhadaRequest(
  input: CriarDespesaCompartilhadaInput
): Promise<{ despesas: { safra_id: string; despesa: Despesa }[] }> {
  const { data } = await apiClient.post('/despesas/compartilhada', input);
  return data;
}
