import apiClient from './apiClient';
import type { Despesa, StatusPagamento, TipoDespesa } from '../types/despesa';

// Contrato idêntico ao já validado no web (frontend/src/services/despesas.ts, pós
// docs/specs/13-rateio-de-despesas.md) — nenhum endpoint novo (docs/specs/mobile/
// 04-despesas-da-sociedade.md).
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
  // localId da fila de sync offline, ecoado como chave de idempotência — mesmo propósito de
  // `idempotency_key` em services/vendas.ts (ver comentário lá).
  idempotency_key?: string;
  // docs/specs/19 — ausente = PAGO (comportamento anterior). data_vencimento obrigatória
  // quando status_pagamento = 'PENDENTE'.
  status_pagamento?: StatusPagamento;
  data_vencimento?: string;
}

export async function criarDespesaRequest(
  safraId: string,
  input: CriarDespesaInput
): Promise<{ despesa: Despesa }> {
  const { data } = await apiClient.post(`/safras/${safraId}/despesas`, input);
  return data;
}

export async function listarDespesasRequest(safraId: string): Promise<{ despesas: Despesa[] }> {
  // periodo 'safra' pra trazer o histórico inteiro — o filtro por período (dia/semana/mês)
  // é escopo do painel de simulação, fora desta spec.
  const { data } = await apiClient.get(`/safras/${safraId}/despesas`, { params: { periodo: 'safra' } });
  return data;
}

// `rateio: null` explícito remove o rateio customizado (volta ao padrão); omitido não mexe
// no rateio atual — mesma distinção do web, que Partial<CriarDespesaInput> sozinho não
// conseguiria expressar.
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

export async function marcarDespesaComoPagaRequest(
  safraId: string,
  despesaId: string
): Promise<{ despesa: Despesa }> {
  const { data } = await apiClient.patch(`/safras/${safraId}/despesas/${despesaId}/pagar`, {});
  return data;
}
