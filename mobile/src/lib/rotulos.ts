import type { StatusSafra } from '../types/safra';
import type { TipoDespesa } from '../types/despesa';

export const ROTULO_STATUS_SAFRA: Record<StatusSafra, string> = {
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
};

// Copiado de frontend/src/lib/rotulos.ts — mesmos rótulos do web (docs/specs/mobile/00-setup-e-infra.md).
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
