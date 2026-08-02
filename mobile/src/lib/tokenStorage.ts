import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '../types/usuario';

// Chaves no Keychain (iOS) / Keystore (Android) via expo-secure-store — não usamos
// AsyncStorage porque o token dá acesso a dados financeiros da sociedade
// (docs/specs/mobile/00-setup-e-infra.md). O usuário também é guardado aqui (não só o
// token) para o bootstrap de sessão entrar direto com dados em cache sem esperar rede
// (docs/specs/mobile/01-auth.md).
const TOKEN_KEY = 'hortiflow_token';
const USUARIO_KEY = 'hortiflow_usuario';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getUsuarioSalvo(): Promise<Usuario | null> {
  const bruto = await SecureStore.getItemAsync(USUARIO_KEY);
  return bruto ? (JSON.parse(bruto) as Usuario) : null;
}

export async function setUsuarioSalvo(usuario: Usuario): Promise<void> {
  await SecureStore.setItemAsync(USUARIO_KEY, JSON.stringify(usuario));
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USUARIO_KEY);
}
