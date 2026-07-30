export type TipoDespesa =
  | 'TERRA'
  | 'MUDAS'
  | 'ADUBO'
  | 'DEFENSIVOS'
  | 'MAO_DE_OBRA'
  | 'EMBALAGEM'
  | 'TRANSPORTE'
  | 'OUTRO';

export interface ItemRateio {
  socio_id: string;
  socio_nome: string;
  percentual: number;
}

export interface Despesa {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  foto_comprovante: string | null;
  descricao: string | null;
  // null = rateio padrão (segue o percentual de lucro); array = rateio customizado dessa
  // despesa (docs/specs/13-rateio-de-despesas.md)
  rateio: ItemRateio[] | null;
}

export interface DespesaPessoal {
  id: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  descricao: string | null;
}
