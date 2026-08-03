// Copiado manualmente de frontend/src/types/simulacao.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md). Sem
// `QuantidadePorUnidade`/`ResumoConsolidado`: fora de escopo da spec `05` mobile (resumo
// consolidado entre safras fica pra um incremento futuro).
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
