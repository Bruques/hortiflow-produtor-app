import type { TipoDespesa } from './despesa';

// Copiado manualmente de frontend/src/types/simulacao.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export interface DivisaoSocio {
  socio_id: string;
  nome: string;
  percentual: number;
  valor: number;
}

export interface Simulacao {
  periodo: { data_inicio: string | null; data_fim: string | null };
  receita: number;
  despesas: number;
  lucroLiquido: number;
  divisao: DivisaoSocio[];
}

export type PeriodoFiltro = 'dia' | 'semana' | 'mes' | 'safra';

// docs/specs/mobile/10-relatorio-completo.md — GET /safras/:id/relatorio-completo, mesmo
// endpoint já usado pelo web (docs/specs/21-relatorio-completo.md).
export interface QuantidadePorUnidade {
  unidade_id: string;
  unidade_nome: string;
  quantidade: number;
}

export interface MediaPrecoPorUnidade {
  unidade_id: string;
  unidade_nome: string;
  media_preco: number;
}

export interface DespesaPorCategoria {
  tipo: TipoDespesa;
  valor: number;
  percentual: number;
}

export interface RelatorioCompleto {
  periodo: { data_inicio: string | null; data_fim: string | null };
  receita: number;
  despesas: number;
  lucroLiquido: number;
  divisao: DivisaoSocio[];
  quantidadePorUnidade: QuantidadePorUnidade[];
  mediaPrecoPorUnidade: MediaPrecoPorUnidade[];
  despesasPorCategoria: DespesaPorCategoria[];
}

// Retorno de GET /safras/resumo — soma "quanto eu recebo" de todas as safras ativas do
// usuário (docs/specs/11-resumo-consolidado-e-despesa-compartilhada.md), pro caso de um
// financiador com uma Sociedade por meeiro (ou, desde a task 23, com várias safras na mesma
// sociedade).
export interface ResumoPorSafra {
  safra_id: string;
  safra_nome: string;
  sociedade_id: string;
  sociedade_nome: string;
  receita: number;
  despesas: number;
  lucroLiquido: number;
  meuValor: number;
}

export interface ResumoConsolidado {
  totalReceber: number;
  safras: ResumoPorSafra[];
}
