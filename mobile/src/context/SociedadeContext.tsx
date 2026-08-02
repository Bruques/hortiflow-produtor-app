import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Sociedade } from '../types/sociedade';

export type SociedadeAtiva = Pick<Sociedade, 'id' | 'nome' | 'codigo_convite'>;

interface SociedadeContextValue {
  sociedade: SociedadeAtiva | null;
  selecionarSociedade: (sociedade: SociedadeAtiva) => void;
}

const SociedadeContext = createContext<SociedadeContextValue | null>(null);

// Equivalente ao SafraContext do web (frontend/src/lib/SafraContext.tsx): guarda qual
// sociedade está selecionada, consumido pela tela de Sócios e, nas specs seguintes, por
// safra/despesas/vendas (docs/specs/mobile/02-sociedade-e-socios.md).
export function SociedadeProvider({ children }: { children: ReactNode }) {
  const [sociedade, setSociedade] = useState<SociedadeAtiva | null>(null);

  const selecionarSociedade = useCallback((s: SociedadeAtiva) => {
    setSociedade(s);
  }, []);

  return (
    <SociedadeContext.Provider value={{ sociedade, selecionarSociedade }}>{children}</SociedadeContext.Provider>
  );
}

export function useSociedadeAtiva(): SociedadeContextValue {
  const contexto = useContext(SociedadeContext);
  if (!contexto) {
    throw new Error('useSociedadeAtiva precisa ser usado dentro de <SociedadeProvider>');
  }
  return contexto;
}
