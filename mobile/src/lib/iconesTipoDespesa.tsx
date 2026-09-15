import { Sprout, Leaf, Droplet, Droplets, ShieldAlert, Users, Package, Truck, Banknote, Zap, Fuel, Receipt } from 'lucide-react-native';
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
  CUSTEIO: Banknote,
  FERTIRRIGACAO: Droplets,
  ENERGIA: Zap,
  OLEO_DIESEL: Fuel,
  OUTRO: Receipt,
};
