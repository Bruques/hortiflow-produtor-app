// Copiado manualmente de frontend/src/types/assinatura.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export interface AssinaturaStatus {
  plano: { nome: string; valorMensal: number; limiteSafrasAtivas: number | null } | null;
  status: 'TRIAL' | 'ATIVA' | 'CANCELADA';
  dataFimAcesso: string;
  vencida: boolean;
  safrasAtivas: number;
  podeCancelar: boolean;
}
