import apiClient from './apiClient';
import type { PeriodoFiltro, RelatorioCompleto, ResumoConsolidado, Simulacao } from '@/types/simulacao';

export async function buscarSimulacaoRequest(safraId: string, periodo: PeriodoFiltro): Promise<Simulacao> {
  const { data } = await apiClient.get(`/safras/${safraId}/simulacao`, { params: { periodo } });
  return data;
}

// Período customizado (data_inicio/data_fim), já suportado pelo controller (docs/specs/
// 05-calculo-e-painel-simulacao.md) mas sem uso no frontend até agora — a tela de Acertos
// usa isso pra calcular "lucro ainda não dividido desde o último acerto".
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

// docs/specs/21-relatorio-completo.md — dashboard de leitura com médias de preço e despesas
// por categoria, além dos mesmos totais/divisão da simulação. Endpoint próprio, sem restrição
// de papel (financiador e meeiro acessam igual).
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

// Soma "quanto eu recebo" de todas as safras ativas do usuário — usado na tela inicial
// quando ele tem 2+ safras (ex: financiador com uma Sociedade por meeiro).
export async function buscarResumoConsolidadoRequest(periodo: PeriodoFiltro): Promise<ResumoConsolidado> {
  const { data } = await apiClient.get('/safras/resumo', { params: { periodo } });
  return data;
}
