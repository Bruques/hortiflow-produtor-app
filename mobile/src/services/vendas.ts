import apiClient from './apiClient';
import type { Venda } from '../types/venda';

// Contrato idêntico ao já validado no web (frontend/src/services/vendas.ts) — nenhum endpoint
// novo (docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
export interface CriarVendaInput {
  data: string;
  quantidade: number;
  preco: number;
  comprador?: string;
  unidade_id: string;
  pago?: boolean;
  regras_por_venda_aplicadas?: string[];
  // localId da fila de sync offline, ecoado como chave de idempotência — se o POST já tiver
  // sido processado (resposta perdida por timeout de rede) o backend devolve a venda
  // existente em vez de criar duplicata (bug relatado 2026-08-11).
  idempotency_key?: string;
}

export async function criarVendaRequest(safraId: string, input: CriarVendaInput): Promise<{ venda: Venda }> {
  const { data } = await apiClient.post(`/safras/${safraId}/vendas`, input);
  return data;
}

export async function listarVendasRequest(safraId: string): Promise<{ vendas: Venda[] }> {
  // periodo 'safra' pra trazer o histórico inteiro — o filtro por período (dia/semana/mês)
  // é escopo do painel de simulação, fora desta spec (mesmo critério do service de despesas).
  const { data } = await apiClient.get(`/safras/${safraId}/vendas`, { params: { periodo: 'safra' } });
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
