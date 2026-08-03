import apiClient from './apiClient';
import type { UnidadeVenda } from '../types/unidadeVenda';

// Cadastro/desativação de unidade exige conexão — ação rara, restrita a
// FINANCIADOR/MISTO, com validação de servidor (nome duplicado) — não entra na fila offline
// (docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
export async function criarUnidadeRequest(sociedadeId: string, nome: string): Promise<{ unidade: UnidadeVenda }> {
  const { data } = await apiClient.post(`/sociedades/${sociedadeId}/unidades-venda`, { nome });
  return data;
}

export async function listarUnidadesRequest(sociedadeId: string): Promise<{ unidades: UnidadeVenda[] }> {
  const { data } = await apiClient.get(`/sociedades/${sociedadeId}/unidades-venda`);
  return data;
}

export async function atualizarAtivoUnidadeRequest(
  unidadeId: string,
  ativo: boolean
): Promise<{ unidade: { id: string; ativo: boolean } }> {
  const { data } = await apiClient.patch(`/unidades-venda/${unidadeId}`, { ativo });
  return data;
}
