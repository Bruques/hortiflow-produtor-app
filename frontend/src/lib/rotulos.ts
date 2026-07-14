import type { TipoDespesa } from '@/types/despesa';
import type { PapelSocio } from '@/types/sociedade';
import type { TipoAcerto } from '@/types/acerto';
import type { TipoGatilhoRegra } from '@/types/regraDespesaRecorrente';

export const ROTULO_TIPO_DESPESA: Record<TipoDespesa, string> = {
  TERRA: 'Terra',
  MUDAS: 'Mudas',
  ADUBO: 'Adubo',
  DEFENSIVOS: 'Defensivos',
  MAO_DE_OBRA: 'Mão de obra',
  EMBALAGEM: 'Embalagem',
  TRANSPORTE: 'Transporte',
  OUTRO: 'Outro',
};

export const ROTULO_PAPEL_SOCIO: Record<PapelSocio, string> = {
  FINANCIADOR: 'Financiador',
  MEEIRO: 'Meeiro',
  MISTO: 'Misto',
};

export const ROTULO_TIPO_ACERTO: Record<TipoAcerto, string> = {
  PARCIAL: 'Parcial',
  FINAL: 'Final (encerra a safra)',
};

export const ROTULO_TIPO_GATILHO: Record<TipoGatilhoRegra, string> = {
  POR_VENDA: 'Por venda (valor por caixa)',
  POR_PERIODO: 'Por período (valor fixo recorrente)',
};
