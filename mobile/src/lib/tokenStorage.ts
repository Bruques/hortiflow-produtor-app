import * as SecureStore from 'expo-secure-store';

// Chave única do token no Keychain (iOS) / Keystore (Android) via expo-secure-store —
// não usamos AsyncStorage porque o token dá acesso a dados financeiros da sociedade
// (docs/specs/mobile/00-setup-e-infra.md).
const TOKEN_KEY = 'hortiflow_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
