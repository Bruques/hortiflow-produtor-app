export type TipoDespesa =
  | 'TERRA'
  | 'MUDAS'
  | 'ADUBO'
  | 'DEFENSIVOS'
  | 'MAO_DE_OBRA'
  | 'EMBALAGEM'
  | 'TRANSPORTE'
  | 'OUTRO';

export interface Despesa {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  foto_comprovante: string | null;
}

export interface DespesaPessoal {
  id: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  descricao: string | null;
}
