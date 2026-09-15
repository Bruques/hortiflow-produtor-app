import apiClient from './apiClient';
import type { AssinaturaStatus } from '@/types/assinatura';

export async function statusAssinaturaRequest(): Promise<AssinaturaStatus> {
  const { data } = await apiClient.get<AssinaturaStatus>('/assinatura/status');
  return data;
}

export async function cancelarAssinaturaRequest(): Promise<{ dataFimAcesso: string }> {
  const { data } = await apiClient.post<{ dataFimAcesso: string }>('/assinatura/cancelar');
  return data;
}

// --- Spec 25: onboarding automatizado e checkout Mercado Pago ---

export type FaixaMeeiros = 'UM_A_TRES' | 'QUATRO_A_DEZ' | 'DEZ_OU_MAIS';
export type LocalizacaoProducao = 'BOM_REPOUSO' | 'OUTRA_CIDADE';

export interface PlanoRecomendado {
  id: string;
  nome: string;
  valorMensal: number;
  valorAnualExibidoPorMes: number;
  valorAnualTotal: number;
}

export interface PlanoCatalogo {
  id: string;
  nome: string;
  valorMensal: number;
  valorAnualExibidoPorMes: number;
  valorAnualTotal: number;
  limiteSafrasAtivas: number | null;
  limiteImportacaoIAMes: number | null;
  despesasPessoais: boolean;
  suportePrioritario: boolean;
  implantacaoAssistidaMensal: boolean;
}

export type CheckoutResultado =
  | { tipo: 'ASSINATURA' | 'COBRANCA_UNICA'; initPoint: string }
  | { tipo: 'PIX'; mpOrderId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string };

export interface VerificarPixResultado {
  pedidoStatus: string;
  vencida: boolean;
  dataFimAcesso: string;
}

export async function listarPlanosRequest(): Promise<PlanoCatalogo[]> {
  const { data } = await apiClient.get<PlanoCatalogo[]>('/assinatura/planos');
  return data;
}

export async function onboardingRequest(dados: {
  faixaMeeiros: FaixaMeeiros;
  quantidadePes: number;
  localizacaoProducao: LocalizacaoProducao;
  localizacaoProducaoOutra?: string;
}): Promise<{ planoRecomendado: PlanoRecomendado }> {
  const { data } = await apiClient.post<{ planoRecomendado: PlanoRecomendado }>('/assinatura/onboarding', dados);
  return data;
}

export async function escolherPlanoRequest(
  planoId: string,
  ciclo: 'MENSAL' | 'ANUAL'
): Promise<{ plano: { id: string; nome: string }; ciclo: 'MENSAL' | 'ANUAL' }> {
  const { data } = await apiClient.patch('/assinatura/plano', { planoId, ciclo });
  return data;
}

export async function checkoutRequest(dados: {
  planoId: string;
  ciclo: 'MENSAL' | 'ANUAL';
  metodo: 'CARTAO' | 'PIX';
}): Promise<CheckoutResultado> {
  const { data } = await apiClient.post<CheckoutResultado>('/assinatura/checkout', {
    ...dados,
    retornoUrl: `${window.location.origin}/assinatura/checkout-retorno`,
  });
  return data;
}

export async function verificarPedidoPixRequest(orderId: string): Promise<VerificarPixResultado> {
  const { data } = await apiClient.get<VerificarPixResultado>(`/assinatura/checkout/pix/${orderId}/status`);
  return data;
}
