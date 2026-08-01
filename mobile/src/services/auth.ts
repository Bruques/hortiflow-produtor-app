import apiClient from './apiClient';
import type { Usuario } from '../types/usuario';

export interface AuthResponse {
  usuario: Usuario;
  token: string;
}

// Cadastro completo, bootstrap de sessão e troca de senha ficam para a spec mobile 01
// (docs/specs/mobile/01-auth.md) — aqui só o suficiente para provar que a tela de login
// consegue autenticar contra a API real (docs/specs/mobile/00-setup-e-infra.md).
export async function loginRequest(telefone: string, senha: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { telefone, senha });
  return data;
}
