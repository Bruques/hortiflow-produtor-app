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
