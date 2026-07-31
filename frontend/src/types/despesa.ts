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
  // true quando a data da despesa já caiu dentro de um Acerto registrado — editar/excluir
  // vai receber 409 do backend (docs/specs/06-acerto.md), então a tela usa isso pra travar
  // a ação de antemão em vez de só reagir ao erro.
  coberta_por_acerto: boolean;
}

export interface DespesaPessoal {
  id: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  descricao: string | null;
}
