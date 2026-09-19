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
  onboardingRespondido: boolean;
}

export interface PlanoAdmin {
  id: string;
  nome: string;
  valorMensal: number;
  valorAnual: number;
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
  metodoUltimoPagamento: 'GATEWAY_ASAAS' | 'GATEWAY_MP_CARTAO' | 'GATEWAY_MP_PIX' | 'MANUAL_PIX' | 'MANUAL_DINHEIRO' | null;
  // Spec 25 — respostas do formulário de qualificação, pra validar se a recomendação
  // automática de plano fez sentido pra esse titular.
  faixaMeeiros: 'UM_A_TRES' | 'QUATRO_A_DEZ' | 'DEZ_OU_MAIS' | null;
  quantidadePes: number | null;
  localizacaoProducao: 'BOM_REPOUSO' | 'OUTRA_CIDADE' | null;
  localizacaoProducaoOutra: string | null;
}
