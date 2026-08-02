import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Safra } from '../types/safra';

export interface SafraAtiva {
  safraId: string;
  sociedadeId: string;
  safra: Safra;
}

interface SafraContextValue {
  safraAtiva: SafraAtiva | null;
  selecionarSafra: (safra: SafraAtiva) => void;
}

const SafraContext = createContext<SafraContextValue | null>(null);

// Equivalente ao SafraContext.tsx do web (frontend/src/lib/SafraContext.tsx): guarda qual
// safra está selecionada, consumido pela tela "dentro da safra" e, nas specs seguintes, por
// despesas/vendas/painel/acerto (docs/specs/mobile/03-safra.md). Substitui o antigo
// SociedadeContext da spec 02 — ver nota registrada em docs/specs/mobile/02-sociedade-e-socios.md.
export function SafraProvider({ children }: { children: ReactNode }) {
  const [safraAtiva, setSafraAtiva] = useState<SafraAtiva | null>(null);

  const selecionarSafra = useCallback((safra: SafraAtiva) => {
    setSafraAtiva(safra);
  }, []);

  return <SafraContext.Provider value={{ safraAtiva, selecionarSafra }}>{children}</SafraContext.Provider>;
}

export function useSafraAtiva(): SafraContextValue {
  const contexto = useContext(SafraContext);
  if (!contexto) {
    throw new Error('useSafraAtiva precisa ser usado dentro de <SafraProvider>');
  }
  return contexto;
}
