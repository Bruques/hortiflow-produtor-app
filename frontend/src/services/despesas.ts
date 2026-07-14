import apiClient from './apiClient';
import type { Despesa, TipoDespesa } from '@/types/despesa';

export interface CriarDespesaInput {
  socio_id: string;
  tipo: TipoDespesa;
  valor: number;
  data: string;
  foto_comprovante?: string;
}

export async function criarDespesaRequest(
  safraId: string,
  input: CriarDespesaInput
): Promise<{ despesa: Despesa }> {
  const { data } = await apiClient.post(`/safras/${safraId}/despesas`, input);
  return data;
}

export async function listarDespesasRequest(safraId: string): Promise<{ despesas: Despesa[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/despesas`);
  return data;
}
