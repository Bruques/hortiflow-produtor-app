import { createContext, useContext } from 'react';

export interface SafraContextValue {
  safraId: string;
  sociedadeId: string;
}

export const SafraContext = createContext<SafraContextValue | null>(null);

// Usado pelas telas de Despesas, Vendas, Simulação, Acertos e Pessoal (dentro do SafraLayout)
// pra saber a qual sociedade a safra atual pertence, sem depender de parâmetro solto na URL.
export function useSafraAtiva(): SafraContextValue {
  const ctx = useContext(SafraContext);
  if (!ctx) {
    throw new Error('useSafraAtiva precisa ser usado dentro de SafraLayout');
  }
  return ctx;
}
