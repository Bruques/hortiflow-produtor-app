import type { TipoDespesa } from './despesa';

export type TipoGatilhoRegra = 'POR_VENDA' | 'POR_PERIODO';

export interface RegraDespesaRecorrente {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: string;
  ativo: boolean;
  criado_por: string;
}

export interface SugestaoDespesaRecorrente {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo_despesa: TipoDespesa;
  valor: string;
}
