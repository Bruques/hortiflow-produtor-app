import { Sprout, Leaf, Droplet, ShieldAlert, Users, Package, Truck, Receipt } from 'lucide-react-native';
import type { TipoDespesa } from '../types/despesa';

// Porta de frontend/src/lib/iconesTipoDespesa.tsx — mesmo ícone por categoria do web, só
// trocando lucide-react por lucide-react-native (docs/specs/mobile/00-setup-e-infra.md).
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
