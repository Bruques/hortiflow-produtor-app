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
