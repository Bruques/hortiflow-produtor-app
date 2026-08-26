import apiClient from './apiClient';
import type { Usuario } from '../types/usuario';

export interface AuthResponse {
  usuario: Usuario;
  token: string;
}

export async function registerRequest(nome: string, telefone: string, senha: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', { nome, telefone, senha });
  return data;
}

export async function loginRequest(telefone: string, senha: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { telefone, senha });
  return data;
}

export async function meRequest(): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.get<{ usuario: Usuario }>('/auth/me');
  return data;
}

export async function trocarSenhaRequest(senha_atual: string, senha_nova: string): Promise<void> {
  await apiClient.put('/auth/senha', { senha_atual, senha_nova });
}

// Best-effort de propósito (spec 17): usado tanto no logout manual quanto no automático
// (401), nunca deve travar o fluxo de saída do usuário se a chamada falhar (ex: sem internet
// no momento do logout). Recebe o token explicitamente (em vez de deixar o interceptor do
// apiClient ler do armazenamento) porque quem chama essa função dispara em paralelo com
// clearToken() — sem isso, é uma corrida: o token some do armazenamento antes do interceptor
// conseguir anexá-lo, e o evento chega no backend sem usuario_id (bug observado em teste real
// no device, 2026-08-26).
export async function logoutRequest(automatico: boolean, token?: string | null): Promise<void> {
  try {
    await apiClient.post(
      '/auth/logout',
      { automatico },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
  } catch {
    // silencioso — é só um registro de auditoria, não pode impedir o logout
  }
}
