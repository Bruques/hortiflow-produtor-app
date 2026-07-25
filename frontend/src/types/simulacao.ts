export interface DivisaoSocio {
  socio_id: string;
  nome: string;
  percentual: number;
  valor: number;
}

export interface QuantidadePorUnidade {
  unidade_id: string;
  unidade_nome: string;
  quantidade: number;
}

export interface Simulacao {
  periodo: { data_inicio: string | null; data_fim: string | null };
  receita: number;
  despesas: number;
  lucroLiquido: number;
  divisao: DivisaoSocio[];
  quantidadePorUnidade: QuantidadePorUnidade[];
}

export type PeriodoFiltro = 'dia' | 'semana' | 'mes' | 'safra';

// Retorno de GET /safras/resumo — soma "quanto eu recebo" de todas as safras ativas do
// usuário (docs/specs/11-resumo-consolidado-e-despesa-compartilhada.md), pro caso de um
// financiador com uma Sociedade por meeiro.
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
