import apiClient from './apiClient';
import type { Usuario } from '@/types/usuario';

export interface AuthResponse {
  usuario: Usuario;
  token: string;
}

export async function registerRequest(
  nome: string,
  telefone: string,
  senha: string
): Promise<AuthResponse> {
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

// Spec 20 — exclusão de conta. Exige a senha atual mesmo com token válido, já que o efeito é
// irreversível (se titular, apaga a(s) sociedade(s) inteiras junto).
export async function excluirContaRequest(senha: string): Promise<void> {
  await apiClient.delete('/auth/me', { data: { senha } });
}

// Best-effort de propósito (spec 17): usado tanto no logout manual quanto no automático
// (401), nunca deve travar o fluxo de saída do usuário se a chamada falhar.
export async function logoutRequest(automatico: boolean): Promise<void> {
  try {
    await apiClient.post('/auth/logout', { automatico });
  } catch {
    // silencioso — é só um registro de auditoria, não pode impedir o logout
  }
}
