import { Sprout, Leaf, Droplet, ShieldAlert, Users, Package, Truck, Receipt } from 'lucide-react';
import type { TipoDespesa } from '@/types/despesa';

// Um ícone por categoria pra identificação rápida na lista (o produtor reconhece pelo ícone
// antes de ler o texto). Reaproveitado também na tela "Nova despesa" (grade de ícones, ver
// docs/design/notas-de-design.md), por isso fica num arquivo à parte em vez de só dentro da
// página de lista.
export const ICONE_TIPO_DESPESA: Record<TipoDespesa, typeof Sprout> = {
  TERRA: Sprout,
  MUDAS: Leaf,
  ADUBO: Droplet,
  DEFENSIVOS: ShieldAlert,
  MAO_DE_OBRA: Users,
  EMBALAGEM: Package,
  TRANSPORTE: Truck,
  OUTRO: Receipt,
};
