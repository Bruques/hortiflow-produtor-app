// Copiado manualmente de frontend/src/types/assinatura.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export interface AssinaturaStatus {
  plano: {
    id: string;
    nome: string;
    valorMensal: number;
    valorAnualTotal: number;
    limiteSafrasAtivas: number | null;
    despesasPessoais: boolean;
    suportePrioritario: boolean;
    implantacaoAssistida: boolean;
  } | null;
  ciclo: 'MENSAL' | 'ANUAL' | null;
  status: 'TRIAL' | 'ATIVA' | 'CANCELADA';
  dataFimAcesso: string;
  vencida: boolean;
  safrasAtivas: number;
  podeCancelar: boolean;
  // Spec 25 — `false` significa que o app deve mostrar o formulário de qualificação
  // antes de qualquer outra tela.
  onboardingRespondido: boolean;
}

// Spec 25 — mesmos 3 planos fixos, agora vindos do formulário de qualificação.
export type FaixaMeeiros = 'UM_A_TRES' | 'QUATRO_A_DEZ' | 'DEZ_OU_MAIS';
export type LocalizacaoProducao = 'BOM_REPOUSO' | 'OUTRA_CIDADE';

export interface PlanoRecomendado {
  id: string;
  nome: string;
  valorMensal: number;
  valorAnualExibidoPorMes: number;
  valorAnualTotal: number;
}

export type CheckoutResultado =
  | { tipo: 'ASSINATURA' | 'COBRANCA_UNICA'; initPoint: string }
  | { tipo: 'PIX'; mpPaymentId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string };

export interface VerificarPixResultado {
  pagamentoStatus: string;
  vencida: boolean;
  dataFimAcesso: string;
}
