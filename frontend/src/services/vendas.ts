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
