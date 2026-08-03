// Copiado manualmente de frontend/src/types/regraDespesaRecorrente.ts — mobile/ e frontend/
// não compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
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
  // null = despesas geradas seguem o rateio padrão; array = rateio definido na criação da
  // regra, copiado pra cada despesa gerada
  rateio: ItemRateio[] | null;
}

export interface SugestaoDespesaRecorrente {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo_despesa: TipoDespesa;
  valor: string;
}
