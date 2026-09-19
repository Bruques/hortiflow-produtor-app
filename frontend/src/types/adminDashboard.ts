// Spec 28 — formato das respostas de /admin/dashboard e das ações do painel do dono.

export type SituacaoProdutor = 'BLOQUEADA' | 'CANCELADA' | 'VENCIDA' | 'TRIAL_EXPIRADO' | 'EM_TRIAL' | 'ATIVA';

export type MetodoPagamento =
  | 'GATEWAY_ASAAS'
  | 'GATEWAY_MP_CARTAO'
  | 'GATEWAY_MP_PIX'
  | 'MANUAL_PIX'
  | 'MANUAL_DINHEIRO'
  | 'MANUAL_CORTESIA';

export interface PagamentoProdutor {
  valor: number;
  metodo: MetodoPagamento;
  periodoInicio: string;
  periodoFim: string;
  data: string;
}

export interface ProdutorDashboard {
  usuarioId: string;
  nome: string;
  telefone: string;
  situacao: SituacaoProdutor;
  plano: { id: string; nome: string } | null;
  ciclo: 'MENSAL' | 'ANUAL' | null;
  dataFimAcesso: string | null;
  totalPago: number;
  safrasAtivas: number;
  limiteSafras: number | null;
  criadoEm: string;
  bloqueado: boolean;
  renovacaoAutomatica: boolean;
  respondeuOnboarding: boolean;
  perfil: { faixaMeeiros: string; quantidadePes: number | null; localizacao: string | null; localizacaoOutra?: string | null } | null;
  pagamentos: PagamentoProdutor[];
}

export type TipoAtencao = 'ACESSO_VENCIDO' | 'RENOVACAO_MANUAL' | 'TRIAL_ACABANDO' | 'ONBOARDING_PARADO';

export interface DashboardAdmin {
  resumo: {
    receitaMes: number;
    receitaMesAnterior: number;
    receitaTotal: number;
    recorrenciaMensal: number;
    ativos: number;
    emTrial: number;
    cadastrados: number;
    cadastradosUltimos7Dias: number;
  };
  receitaPorMes: { mes: string; valor: number; pagamentos: number }[];
  crescimentoSemanal: { semana: string; cadastrados: number; pagantes: number }[];
  funil: { cadastraram: number; responderamOnboarding: number; escolheramPlano: number; pagaram: number };
  atencao: { usuarioId: string; tipo: TipoAtencao; titulo: string; detalhe: string }[];
  ultimosPagamentos: {
    usuarioId: string;
    nome: string;
    plano: string | null;
    metodo: MetodoPagamento;
    valor: number;
    data: string;
    periodoFim: string;
  }[];
  produtores: ProdutorDashboard[];
}

export interface DescontoCobranca {
  tipo: 'PERCENTUAL' | 'VALOR';
  valor: number;
}

export interface NovaCobranca {
  planoId: string;
  ciclo: 'MENSAL' | 'ANUAL';
  metodo: 'PIX' | 'CARTAO';
  desconto?: DescontoCobranca;
}

export type CobrancaGerada =
  | { tipo: 'PIX'; valorBase: number; valorFinal: number; mpOrderId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string }
  | { tipo: 'CARTAO'; valorBase: number; valorFinal: number; linkPagamento: string };
