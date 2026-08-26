export interface AssinaturaStatus {
  plano: { nome: string; valorMensal: number; limiteSafrasAtivas: number | null } | null;
  status: 'TRIAL' | 'ATIVA' | 'CANCELADA';
  dataFimAcesso: string;
  vencida: boolean;
  safrasAtivas: number;
  podeCancelar: boolean;
}

export interface PlanoAdmin {
  id: string;
  nome: string;
  valorMensal: number;
  limiteSafrasAtivas: number | null;
}

export interface TitularAdmin {
  usuarioId: string;
  nome: string;
  telefone: string;
  plano: { id: string; nome: string } | null;
  status: 'TRIAL' | 'ATIVA' | 'CANCELADA' | null;
  dataFimAcesso: string | null;
  vencida: boolean;
  safrasAtivas: number;
  limiteSafrasAtivas: number | null;
  metodoUltimoPagamento: 'GATEWAY_ASAAS' | 'MANUAL_PIX' | 'MANUAL_DINHEIRO' | null;
}
