import type { ItemRateio, TipoDespesa } from './despesa';

export type TipoGatilhoRegra = 'POR_VENDA' | 'POR_PERIODO';

export interface RegraDespesaRecorrente {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  ativo: boolean;
  criado_por: string;
  // null = despesas geradas seguem o rateio padrão; array = rateio definido na regra
  // (editável — docs/specs/04, adendo 2026-08-04), copiado pra cada despesa gerada
  // (docs/specs/13-rateio-de-despesas.md)
  rateio: ItemRateio[] | null;
}

export interface SugestaoDespesaRecorrente {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo_despesa: TipoDespesa;
  valor: string;
}
