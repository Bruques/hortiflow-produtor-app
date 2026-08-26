import adminApiClient from './adminApiClient';
import type { TitularAdmin, PlanoAdmin } from '@/types/assinatura';

export interface AdminAuthResponse {
  admin: { id: string; nome: string; email: string };
  token: string;
}

// Sem token ainda nesse momento (é ele quem gera o token) — mas usa o mesmo adminApiClient
// por conveniência, já que o interceptor só anexa Authorization se já existir um token salvo.
export async function loginAdminRequest(email: string, senha: string): Promise<AdminAuthResponse> {
  const { data } = await adminApiClient.post<AdminAuthResponse>('/admin/auth/login', { email, senha });
  return data;
}

export async function listarAssinaturasRequest(): Promise<TitularAdmin[]> {
  const { data } = await adminApiClient.get<TitularAdmin[]>('/admin/assinaturas');
  return data;
}

export async function listarPlanosRequest(): Promise<PlanoAdmin[]> {
  const { data } = await adminApiClient.get<PlanoAdmin[]>('/admin/planos');
  return data;
}

export async function editarPlanoRequest(
  planoId: string,
  dados: { valorMensal?: number; limiteSafrasAtivas?: number | null }
): Promise<void> {
  await adminApiClient.patch(`/admin/planos/${planoId}`, dados);
}

export async function atribuirPlanoRequest(usuarioId: string, planoId: string): Promise<void> {
  await adminApiClient.patch(`/admin/assinaturas/${usuarioId}/plano`, { planoId });
}

export async function definirLimiteSafrasRequest(
  usuarioId: string,
  limiteSafrasAtivasOverride: number | null
): Promise<void> {
  await adminApiClient.patch(`/admin/assinaturas/${usuarioId}/limite-safras`, { limiteSafrasAtivasOverride });
}

export async function gerarCheckoutLinkRequest(usuarioId: string): Promise<{ checkoutUrl: string }> {
  const { data } = await adminApiClient.post<{ checkoutUrl: string }>(`/admin/assinaturas/${usuarioId}/checkout-link`);
  return data;
}

export async function registrarPagamentoManualRequest(
  usuarioId: string,
  dados: { valor: number; metodo: 'MANUAL_PIX' | 'MANUAL_DINHEIRO'; dias: number }
): Promise<{ dataFimAcesso: string }> {
  const { data } = await adminApiClient.post<{ dataFimAcesso: string }>(
    `/admin/assinaturas/${usuarioId}/pagamento-manual`,
    dados
  );
  return data;
}
