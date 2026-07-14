import apiClient from './apiClient';
import type { DespesaPessoal, TipoDespesa } from '@/types/despesa';

export interface DespesaPessoalInput {
  tipo: TipoDespesa;
  valor: number;
  data: string;
  descricao?: string;
}

export async function criarDespesaPessoalRequest(
  safraId: string,
  input: DespesaPessoalInput
): Promise<{ despesaPessoal: DespesaPessoal }> {
  const { data } = await apiClient.post(`/safras/${safraId}/despesas-pessoais`, input);
  return data;
}

export async function listarDespesasPessoaisRequest(
  safraId: string
): Promise<{ despesasPessoais: DespesaPessoal[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/despesas-pessoais`);
  return data;
}

export async function atualizarDespesaPessoalRequest(
  id: string,
  input: Partial<DespesaPessoalInput>
): Promise<{ despesaPessoal: DespesaPessoal }> {
  const { data } = await apiClient.put(`/despesas-pessoais/${id}`, input);
  return data;
}

export async function excluirDespesaPessoalRequest(id: string): Promise<void> {
  await apiClient.delete(`/despesas-pessoais/${id}`);
}
