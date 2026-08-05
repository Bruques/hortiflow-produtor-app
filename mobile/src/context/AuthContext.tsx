import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, getToken, getUsuarioSalvo, setToken, setUsuarioSalvo } from '../lib/tokenStorage';
import { deveDeslogarPorErro } from '../lib/bootstrapSessao';
import { meRequest } from '../services/auth';
import apiClient from '../services/apiClient';
import type { Usuario } from '../types/usuario';

interface AuthContextValue {
  usuario: Usuario | null;
  logado: boolean;
  carregando: boolean;
  entrar: (token: string, usuario: Usuario) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Bootstrap de sessão (docs/specs/mobile/01-auth.md): se há token salvo, entra direto na
// tela principal com os dados em cache — a chamada a `/auth/me` roda em paralelo só para
// confirmar que o token ainda é válido, nunca como bloqueio de entrada. Só um 401 explícito
// desloga; erro de rede mantém a sessão (ver src/lib/bootstrapSessao.ts).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [logado, setLogado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const [token, usuarioCache] = await Promise.all([getToken(), getUsuarioSalvo()]);

      if (!token) {
        setCarregando(false);
        return;
      }

      setUsuario(usuarioCache);
      setLogado(true);
      setCarregando(false);

      try {
        const { usuario: usuarioAtualizado } = await meRequest();
        setUsuario(usuarioAtualizado);
        await setUsuarioSalvo(usuarioAtualizado);
      } catch (erro) {
        if (deveDeslogarPorErro(erro)) {
          await clearToken();
          setUsuario(null);
          setLogado(false);
        }
      }
    })();
  }, []);

  const entrar = useCallback(async (token: string, usuarioLogado: Usuario) => {
    await setToken(token);
    await setUsuarioSalvo(usuarioLogado);
    setUsuario(usuarioLogado);
    setLogado(true);
  }, []);

  const sair = useCallback(async () => {
    await clearToken();
    setUsuario(null);
    setLogado(false);
  }, []);

  // Sem isso, um 401 numa chamada qualquer feita depois do bootstrap (token expirado em uso,
  // não só ao abrir o app) deixava o usuário preso na tela com erro genérico de carregamento,
  // sem nunca ser levado de volta pro login — mesmo gap do apiClient do web.
  useEffect(() => {
    const id = apiClient.interceptors.response.use(
      (response) => response,
      (erro) => {
        if (deveDeslogarPorErro(erro)) {
          sair();
        }
        return Promise.reject(erro);
      }
    );
    return () => apiClient.interceptors.response.eject(id);
  }, [sair]);

  return (
    <AuthContext.Provider value={{ usuario, logado, carregando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>');
  }
  return contexto;
}
