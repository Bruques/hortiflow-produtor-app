import apiClient from './apiClient';
import type { PeriodoFiltro, RelatorioCompleto, ResumoConsolidado, Simulacao } from '../types/simulacao';

// Contrato idêntico ao já validado no web (frontend/src/services/simulacao.ts) — nenhum
// endpoint novo (docs/specs/mobile/05-painel-e-acerto.md).
export async function buscarSimulacaoRequest(safraId: string, periodo: PeriodoFiltro): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, { params: { periodo } });
  return data;
}

export async function buscarSimulacaoPersonalizadaRequest(
  safraId: string,
  dataInicio: string,
  dataFim: string
): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, {
    params: { data_inicio: dataInicio, data_fim: dataFim },
  });
  return data;
}

// docs/specs/mobile/10-relatorio-completo.md — mesmo endpoint já usado pelo web
// (docs/specs/21-relatorio-completo.md), sem restrição de papel.
export async function buscarRelatorioCompletoRequest(safraId: string, periodo: PeriodoFiltro): Promise<RelatorioCompleto> {
  const { data } = await apiClient.get(`/safras/${safraId}/relatorio-completo`, { params: { periodo } });
  return data;
}

export async function buscarRelatorioCompletoPersonalizadoRequest(
  safraId: string,
  dataInicio: string,
  dataFim: string
): Promise<RelatorioCompleto> {
  const { data } = await apiClient.get(`/safras/${safraId}/relatorio-completo`, {
    params: { data_inicio: dataInicio, data_fim: dataFim },
  });
  return data;
}

// Soma "quanto eu recebo" de todas as safras ativas do usuário — card de resumo consolidado
// na tela de Início quando ele tem 2+ safras (docs/specs/11-resumo-consolidado-e-despesa-
// compartilhada.md, retomado no mobile em 2026-09-05).
export async function buscarResumoConsolidadoRequest(periodo: PeriodoFiltro): Promise<ResumoConsolidado> {
  const { data } = await apiClient.get('/safras/resumo', { params: { periodo } });
  return data;
}
