import { createContext, useContext } from 'react';
import type { Safra } from '@/types/safra';

export interface SafraContextValue {
  safraId: string;
  sociedadeId: string;
  safra: Safra;
}

export const SafraContext = createContext<SafraContextValue | null>(null);

// Usado pelas telas de Início, Despesas, Vendas, Acertos, Pessoal e Menu (dentro do SafraLayout)
// pra saber a qual sociedade a safra atual pertence, sem depender de parâmetro solto na URL —
// e pra reaproveitar a Safra já carregada (nome/status/datas) sem buscar de novo em cada tela.
export function useSafraAtiva(): SafraContextValue {
  const ctx = useContext(SafraContext);
  if (!ctx) {
    throw new Error('useSafraAtiva precisa ser usado dentro de SafraLayout');
  }
  return ctx;
}
