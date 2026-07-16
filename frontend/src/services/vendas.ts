import apiClient from './apiClient';
import type { Venda } from '@/types/venda';

export interface CriarVendaInput {
  data: string;
  quantidade: number;
  preco: number;
  comprador?: string;
}

export async function criarVendaRequest(safraId: string, input: CriarVendaInput): Promise<{ venda: Venda }> {
  const { data } = await apiClient.post(`/safras/${safraId}/vendas`, input);
  return data;
}

export async function listarVendasRequest(safraId: string): Promise<{ vendas: Venda[] }> {
  const { data } = await apiClient.get(`/safras/${safraId}/vendas`);
  return data;
}

export type AtualizarVendaInput = Partial<CriarVendaInput>;

export async function atualizarVendaRequest(
  safraId: string,
  vendaId: string,
  input: AtualizarVendaInput
): Promise<{ venda: Venda }> {
  const { data } = await apiClient.put(`/safras/${safraId}/vendas/${vendaId}`, input);
  return data;
}

export async function excluirVendaRequest(safraId: string, vendaId: string): Promise<void> {
  await apiClient.delete(`/safras/${safraId}/vendas/${vendaId}`);
}
