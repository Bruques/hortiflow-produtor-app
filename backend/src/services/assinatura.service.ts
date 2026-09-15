import { CicloAssinatura, FaixaMeeiros, LocalizacaoProducao, MetodoPagamento, StatusAssinatura, StatusSafra } from '@prisma/client';
import prisma from '../lib/prisma';
import * as asaasService from './asaas.service';
import * as mercadopagoService from './mercadopago.service';

const TRIAL_DIAS = Number(process.env.TRIAL_DIAS || 14);

// Spec 25 — a resposta de quantidade de meeiros no formulário de qualificação mapeia
// direto pro plano recomendado, por nome (nomes fixos, ver migration spec25_onboarding_e_checkout).
const PLANO_POR_FAIXA_MEEIROS: Record<FaixaMeeiros, string> = {
  UM_A_TRES: 'Essencial',
  QUATRO_A_DEZ: 'Profissional',
  DEZ_OU_MAIS: 'Gestão',
};

export function mensagemAssinaturaVencida(): string {
  return `Seu acesso ao HortiFlow expirou. Fale com a gente pelo WhatsApp ${process.env.WHATSAPP_CONTATO} ou e-mail ${process.env.EMAIL_CONTATO} para continuar.`;
}

function somarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

export async function criarAssinaturaTrial(usuarioId: string) {
  const agora = new Date();
  await prisma.assinatura.create({
    data: {
      usuario_id: usuarioId,
      status: StatusAssinatura.TRIAL,
      data_inicio: agora,
      data_fim_acesso: somarDias(agora, TRIAL_DIAS),
    },
  });
}

async function buscarAssinaturaPorUsuario(usuarioId: string) {
  return prisma.assinatura.findUnique({
    where: { usuario_id: usuarioId },
    include: { plano: true },
  });
}

// Limite efetivo de safras ativas para um titular: override pontual > limite do plano >
// sem limite (plano ainda não atribuído, ou Plano 3 com limite null = ilimitado).
function limiteEfetivo(assinatura: { limite_safras_ativas_override: number | null; plano: { limite_safras_ativas: number | null } | null }): number | null {
  if (assinatura.limite_safras_ativas_override !== null && assinatura.limite_safras_ativas_override !== undefined) {
    return assinatura.limite_safras_ativas_override;
  }
  return assinatura.plano?.limite_safras_ativas ?? null;
}

async function contarSafrasEmAndamentoDoTitular(titularUsuarioId: string): Promise<number> {
  return prisma.safra.count({
    where: {
      status: StatusSafra.EM_ANDAMENTO,
      sociedade: { criado_por_usuario_id: titularUsuarioId },
    },
  });
}

// Usado pelo gate de tempo (402) — dado o id do titular de uma Sociedade, diz se o acesso
// está liberado agora. Vencida = qualquer usuário (titular ou meeiro) daquela sociedade
// recebe 402 (ver docs/specs/18-assinatura-e-pagamento.md).
export async function acessoLiberadoParaTitular(titularUsuarioId: string): Promise<boolean> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: titularUsuarioId } });
  if (!assinatura) return false;
  return assinatura.data_fim_acesso >= new Date();
}

export async function acessoLiberadoParaSociedade(sociedadeId: string): Promise<boolean> {
  const sociedade = await prisma.sociedade.findUnique({
    where: { id: sociedadeId },
    select: { criado_por_usuario_id: true },
  });
  if (!sociedade) return true; // sociedade não existe: quem trata é o 404 do controller, não o gate
  return acessoLiberadoParaTitular(sociedade.criado_por_usuario_id);
}

export async function acessoLiberadoParaSafra(safraId: string): Promise<boolean> {
  const safra = await prisma.safra.findUnique({
    where: { id: safraId },
    select: { sociedade: { select: { criado_por_usuario_id: true } } },
  });
  if (!safra) return true; // idem: 404 é responsabilidade do controller
  return acessoLiberadoParaTitular(safra.sociedade.criado_por_usuario_id);
}

// Task 24, adendo 2026-09-09 — importação de lançamentos por IA era exclusiva de "Plano 2"/
// "Plano 3". Spec 25 muda isso: a nova tabela de preços dá acesso a TODOS os planos, só com
// limite mensal diferente (Essencial 40, Profissional 100, Gestão 150 — `limite_importacao_ia_mes`
// do Plano). O que esta função ainda NÃO faz é contar quantas importações o titular já usou
// no mês e comparar com esse limite — a spec 25 não define essa contagem (sem critério de
// aceite sobre isso), então por ora o gate é só "tem algum plano atribuído", igual ao texto
// da spec. Ver docs/specs/25-onboarding-e-checkout-automatizados.md.
export async function planoPermiteImportacaoPorIA(titularUsuarioId: string): Promise<boolean> {
  const assinatura = await prisma.assinatura.findUnique({
    where: { usuario_id: titularUsuarioId },
    include: { plano: true },
  });
  return !!assinatura?.plano;
}

export async function planoPermiteImportacaoPorIAParaSafra(safraId: string): Promise<boolean> {
  const safra = await prisma.safra.findUnique({
    where: { id: safraId },
    select: { sociedade: { select: { criado_por_usuario_id: true } } },
  });
  if (!safra) return false; // 404 é responsabilidade do controller — aqui só nega por segurança
  return planoPermiteImportacaoPorIA(safra.sociedade.criado_por_usuario_id);
}

// Gate de quantidade (403) — chamado antes de colocar uma Safra em EM_ANDAMENTO.
export async function podeAtivarSafra(titularUsuarioId: string): Promise<boolean> {
  const assinatura = await buscarAssinaturaPorUsuario(titularUsuarioId);
  if (!assinatura) return true; // sem assinatura ainda (não deveria acontecer) — não bloqueia por limite
  const limite = limiteEfetivo(assinatura);
  if (limite === null) return true; // sem plano atribuído ou plano ilimitado
  const emAndamento = await contarSafrasEmAndamentoDoTitular(titularUsuarioId);
  return emAndamento < limite;
}

export async function statusDoUsuario(usuarioId: string) {
  const assinatura = await buscarAssinaturaPorUsuario(usuarioId);
  if (!assinatura) {
    return null;
  }
  const emAndamento = await contarSafrasEmAndamentoDoTitular(usuarioId);
  return {
    plano: assinatura.plano
      ? {
          id: assinatura.plano.id,
          nome: assinatura.plano.nome,
          valorMensal: Number(assinatura.plano.valor_mensal),
          valorAnualTotal: Number(assinatura.plano.valor_anual),
          limiteSafrasAtivas: assinatura.plano.limite_safras_ativas,
          despesasPessoais: assinatura.plano.despesas_pessoais,
          suportePrioritario: assinatura.plano.suporte_prioritario,
          // Regra da spec 25: anual libera em qualquer plano; mensal só em quem já tem
          // `implantacao_assistida_mensal` (Profissional/Gestão).
          implantacaoAssistida: assinatura.ciclo === CicloAssinatura.ANUAL || assinatura.plano.implantacao_assistida_mensal,
        }
      : null,
    ciclo: assinatura.ciclo,
    status: assinatura.status,
    dataFimAcesso: assinatura.data_fim_acesso,
    vencida: assinatura.data_fim_acesso < new Date(),
    safrasAtivas: emAndamento,
    podeCancelar:
      (!!assinatura.asaas_subscription_id || !!assinatura.mp_preapproval_id) && assinatura.status === StatusAssinatura.ATIVA,
    // Spec 25 — `faixa_meeiros` só é gravado por `responderOnboarding`, então não nulo
    // significa "já respondeu o formulário uma vez".
    onboardingRespondido: assinatura.faixa_meeiros !== null,
  };
}

type CancelarResultado = { erro: 'SEM_ASSINATURA_ATIVA' } | { dataFimAcesso: Date };

export async function cancelarAssinaturaDoUsuario(usuarioId: string): Promise<CancelarResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura?.asaas_subscription_id && !assinatura?.mp_preapproval_id) {
    return { erro: 'SEM_ASSINATURA_ATIVA' };
  }

  if (assinatura.mp_preapproval_id) {
    await mercadopagoService.cancelarAssinatura(assinatura.mp_preapproval_id);
  } else if (assinatura.asaas_subscription_id) {
    await asaasService.cancelarAssinatura(assinatura.asaas_subscription_id);
  }

  const atualizada = await prisma.assinatura.update({
    where: { usuario_id: usuarioId },
    data: { status: StatusAssinatura.CANCELADA },
  });

  return { dataFimAcesso: atualizada.data_fim_acesso };
}

// --- Spec 25: onboarding automatizado e checkout Mercado Pago ---

type OnboardingResultado =
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'ONBOARDING_JA_RESPONDIDO' }
  | { erro: 'PLANO_NAO_ENCONTRADO' }
  | {
      planoRecomendado: {
        id: string;
        nome: string;
        valorMensal: number;
        valorAnualExibidoPorMes: number;
        valorAnualTotal: number;
      };
    };

export async function responderOnboarding(
  usuarioId: string,
  dados: {
    faixaMeeiros: FaixaMeeiros;
    quantidadePes: number;
    localizacaoProducao: LocalizacaoProducao;
    localizacaoProducaoOutra?: string;
  }
): Promise<OnboardingResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };
  if (assinatura.faixa_meeiros !== null) return { erro: 'ONBOARDING_JA_RESPONDIDO' };

  const nomePlano = PLANO_POR_FAIXA_MEEIROS[dados.faixaMeeiros];
  const plano = await prisma.plano.findFirst({ where: { nome: nomePlano } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  await prisma.assinatura.update({
    where: { usuario_id: usuarioId },
    data: {
      faixa_meeiros: dados.faixaMeeiros,
      quantidade_pes_morango: dados.quantidadePes,
      localizacao_producao: dados.localizacaoProducao,
      // null explícito quando não é OUTRA_CIDADE — evita sobrar um valor antigo se o
      // produtor respondesse de novo depois de um erro (ainda que hoje o formulário só
      // deixe responder uma vez).
      localizacao_producao_outra: dados.localizacaoProducao === 'OUTRA_CIDADE' ? (dados.localizacaoProducaoOutra ?? null) : null,
    },
  });

  return {
    planoRecomendado: {
      id: plano.id,
      nome: plano.nome,
      valorMensal: Number(plano.valor_mensal),
      valorAnualExibidoPorMes: Math.round((Number(plano.valor_anual) / 12) * 100) / 100,
      valorAnualTotal: Number(plano.valor_anual),
    },
  };
}

// Catálogo público (produtor autenticado) dos 3 planos com todos os recursos — usado pela
// tela de plano do onboarding pra mostrar as 3 opções, não só a recomendada. Não estava no
// contrato original da spec 25 (só listava o recomendado); necessidade descoberta na
// implementação, registrada aqui em vez de decidida silenciosamente.
export async function listarPlanosPublico() {
  const planos = await prisma.plano.findMany({ orderBy: { valor_mensal: 'asc' } });
  return planos.map((p) => ({
    id: p.id,
    nome: p.nome,
    valorMensal: Number(p.valor_mensal),
    valorAnualExibidoPorMes: Math.round((Number(p.valor_anual) / 12) * 100) / 100,
    valorAnualTotal: Number(p.valor_anual),
    limiteSafrasAtivas: p.limite_safras_ativas,
    limiteImportacaoIAMes: p.limite_importacao_ia_mes,
    despesasPessoais: p.despesas_pessoais,
    suportePrioritario: p.suporte_prioritario,
    implantacaoAssistidaMensal: p.implantacao_assistida_mensal,
  }));
}

type EscolherPlanoResultado =
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'PLANO_NAO_ENCONTRADO' }
  | { plano: { id: string; nome: string }; ciclo: CicloAssinatura };

export async function escolherPlano(
  usuarioId: string,
  planoId: string,
  ciclo: CicloAssinatura
): Promise<EscolherPlanoResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const plano = await prisma.plano.findUnique({ where: { id: planoId } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  // Confirmar plano/ciclo aqui NÃO cobra nada — só grava a escolha. A cobrança de fato
  // só acontece em `iniciarCheckout`.
  await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { plano_id: planoId, ciclo } });
  return { plano: { id: plano.id, nome: plano.nome }, ciclo };
}

type CheckoutResultado =
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'PLANO_NAO_ENCONTRADO' }
  | { tipo: 'ASSINATURA'; mpSubscriptionId: string; initPoint: string }
  | { tipo: 'COBRANCA_UNICA'; mpPaymentId: string; initPoint: string }
  | { tipo: 'PIX'; mpPaymentId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string };

export async function iniciarCheckout(
  usuarioId: string,
  dados: { planoId: string; ciclo: CicloAssinatura; metodo: 'CARTAO' | 'PIX'; cpf?: string },
  urls: { callbackUrl: string; notificationUrl: string }
): Promise<CheckoutResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const plano = await prisma.plano.findUnique({ where: { id: dados.planoId } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  const cicloTexto = dados.ciclo === CicloAssinatura.ANUAL ? 'anual' : 'mensal';
  const descricao = `HortiFlow — ${plano.nome} (${cicloTexto})`;
  const valor = dados.ciclo === CicloAssinatura.ANUAL ? Number(plano.valor_anual) : Number(plano.valor_mensal);

  // Pix nunca passa pelo Checkout Pro (redirecionamento hospedado) — descoberto em teste
  // manual (2026-09-15) que ele exige o pagador logar numa conta Mercado Pago, o que não
  // faz sentido pro nosso caso. Em vez disso, gera o QR Code direto via API de Pagamentos,
  // mostrado dentro do próprio app (ver mercadopago.service.ts). CPF é opcional — testado
  // sem ele e o Mercado Pago aceitou normalmente.
  if (dados.metodo === 'PIX') {
    const pix = await mercadopagoService.criarPagamentoPix({
      usuarioId,
      descricao,
      valor,
      cpf: dados.cpf,
      externalReference: assinatura.id,
      notificationUrl: urls.notificationUrl,
    });
    await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { plano_id: plano.id, ciclo: dados.ciclo } });
    return {
      tipo: 'PIX',
      mpPaymentId: pix.paymentId,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      dataExpiracao: pix.dataExpiracao,
    };
  }

  // Mensal + cartão é o único caso que vira assinatura recorrente de verdade — anual +
  // cartão é cobrança única (ver spec 25).
  if (dados.ciclo === CicloAssinatura.MENSAL) {
    const { preapprovalId, initPoint } = await mercadopagoService.criarAssinaturaRecorrente({
      usuarioId,
      descricao,
      valorMensal: Number(plano.valor_mensal),
      externalReference: assinatura.id,
      callbackUrl: urls.callbackUrl,
    });
    await prisma.assinatura.update({
      where: { usuario_id: usuarioId },
      data: { plano_id: plano.id, ciclo: dados.ciclo, mp_preapproval_id: preapprovalId },
    });
    return { tipo: 'ASSINATURA', mpSubscriptionId: preapprovalId, initPoint };
  }

  const { preferenceId, initPoint } = await mercadopagoService.criarCobrancaUnicaCartao({
    usuarioId,
    descricao,
    valor,
    externalReference: assinatura.id,
    callbackUrl: urls.callbackUrl,
    notificationUrl: urls.notificationUrl,
  });
  await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { plano_id: plano.id, ciclo: dados.ciclo } });
  return { tipo: 'COBRANCA_UNICA', mpPaymentId: preferenceId, initPoint };
}

// --- Admin ---

export async function listarPlanos() {
  const planos = await prisma.plano.findMany({ orderBy: { valor_mensal: 'asc' } });
  return planos.map((p) => ({
    id: p.id,
    nome: p.nome,
    valorMensal: Number(p.valor_mensal),
    limiteSafrasAtivas: p.limite_safras_ativas,
  }));
}

export async function listarParaAdmin() {
  const titulares = await prisma.usuario.findMany({
    where: { sociedadesCriadas: { some: {} } },
    select: {
      id: true,
      nome: true,
      telefone: true,
      assinatura: {
        include: { plano: true, pagamentos: { orderBy: { criado_em: 'desc' }, take: 1 } },
      },
    },
  });

  return Promise.all(
    titulares.map(async (u) => {
      const assinatura = u.assinatura;
      const safrasAtivas = await contarSafrasEmAndamentoDoTitular(u.id);
      return {
        usuarioId: u.id,
        nome: u.nome,
        telefone: u.telefone,
        plano: assinatura?.plano ? { id: assinatura.plano.id, nome: assinatura.plano.nome } : null,
        status: assinatura?.status ?? null,
        dataFimAcesso: assinatura?.data_fim_acesso ?? null,
        vencida: assinatura ? assinatura.data_fim_acesso < new Date() : true,
        safrasAtivas,
        limiteSafrasAtivas: assinatura ? limiteEfetivo(assinatura) : null,
        metodoUltimoPagamento: assinatura?.pagamentos[0]?.metodo ?? null,
        // Spec 25 — respostas do formulário de qualificação, pra você validar se a
        // recomendação automática de plano fez sentido pra esse titular.
        faixaMeeiros: assinatura?.faixa_meeiros ?? null,
        quantidadePes: assinatura?.quantidade_pes_morango ?? null,
        localizacaoProducao: assinatura?.localizacao_producao ?? null,
        localizacaoProducaoOutra: assinatura?.localizacao_producao_outra ?? null,
      };
    })
  );
}

type AtribuirPlanoResultado = { erro: 'ASSINATURA_NAO_ENCONTRADA' } | { erro: 'PLANO_NAO_ENCONTRADO' } | { plano: { id: string; nome: string } };

export async function atribuirPlano(usuarioId: string, planoId: string): Promise<AtribuirPlanoResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const plano = await prisma.plano.findUnique({ where: { id: planoId } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { plano_id: planoId } });
  return { plano: { id: plano.id, nome: plano.nome } };
}

type OverrideResultado = { erro: 'ASSINATURA_NAO_ENCONTRADA' } | { limiteEfetivo: number | null };

export async function definirLimiteOverride(usuarioId: string, limite: number | null): Promise<OverrideResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId }, include: { plano: true } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const atualizada = await prisma.assinatura.update({
    where: { usuario_id: usuarioId },
    data: { limite_safras_ativas_override: limite },
    include: { plano: true },
  });
  return { limiteEfetivo: limiteEfetivo(atualizada) };
}

type EditarPlanoResultado = { erro: 'PLANO_NAO_ENCONTRADO' } | { plano: { id: string; nome: string; valorMensal: number; limiteSafrasAtivas: number | null } };

export async function editarPlano(
  planoId: string,
  dados: { valorMensal?: number; limiteSafrasAtivas?: number | null }
): Promise<EditarPlanoResultado> {
  const plano = await prisma.plano.findUnique({ where: { id: planoId } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  const atualizado = await prisma.plano.update({
    where: { id: planoId },
    data: {
      ...(dados.valorMensal !== undefined ? { valor_mensal: dados.valorMensal } : {}),
      ...(dados.limiteSafrasAtivas !== undefined ? { limite_safras_ativas: dados.limiteSafrasAtivas } : {}),
    },
  });

  return {
    plano: {
      id: atualizado.id,
      nome: atualizado.nome,
      valorMensal: Number(atualizado.valor_mensal),
      limiteSafrasAtivas: atualizado.limite_safras_ativas,
    },
  };
}

type CheckoutLinkResultado =
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'PLANO_NAO_ATRIBUIDO' }
  | { checkoutUrl: string };

export async function gerarCheckoutLink(usuarioId: string, callbackUrl: string): Promise<CheckoutLinkResultado> {
  const assinatura = await prisma.assinatura.findUnique({
    where: { usuario_id: usuarioId },
    include: { plano: true, usuario: true },
  });
  // `assinatura.usuario` só é null pra assinatura de uma conta já excluída (spec 20), o que
  // não deveria conseguir chegar aqui (usuarioId vem de uma sessão autenticada em uso).
  if (!assinatura || !assinatura.usuario) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };
  if (!assinatura.plano) return { erro: 'PLANO_NAO_ATRIBUIDO' };

  let customerId = assinatura.asaas_customer_id;
  if (!customerId) {
    customerId = await asaasService.criarCustomer(assinatura.usuario.nome, assinatura.usuario.telefone);
    await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { asaas_customer_id: customerId } });
  }

  const checkoutUrl = await asaasService.criarCheckoutAssinatura({
    customerId,
    descricao: `HortiFlow — ${assinatura.plano.nome}`,
    valorMensal: Number(assinatura.plano.valor_mensal),
    callbackUrl,
  });

  return { checkoutUrl };
}

export async function registrarPagamentoManual(
  usuarioId: string,
  dados: { valor: number; metodo: Extract<MetodoPagamento, 'MANUAL_PIX' | 'MANUAL_DINHEIRO'>; dias: number },
  adminId: string
): Promise<{ erro: 'ASSINATURA_NAO_ENCONTRADA' } | { dataFimAcesso: Date }> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const agora = new Date();
  // "Estender a partir do vencimento atual" só faz sentido pra quem já é assinante pago
  // renovando adiantado (não perde dias já pagos). Quem ainda está em TRIAL não deve
  // "empilhar" o pagamento em cima dos dias de teste que sobraram — o pagamento começa a
  // contar de hoje, substituindo o trial, não somando a ele.
  const base = assinatura.status === StatusAssinatura.ATIVA && assinatura.data_fim_acesso > agora
    ? assinatura.data_fim_acesso
    : agora;
  const novaDataFim = somarDias(base, dados.dias);

  await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        assinatura_id: assinatura.id,
        metodo: dados.metodo,
        valor: dados.valor,
        periodo_inicio: base,
        periodo_fim: novaDataFim,
        registrado_por_admin_id: adminId,
      },
    }),
    prisma.assinatura.update({
      where: { usuario_id: usuarioId },
      data: { data_fim_acesso: novaDataFim, status: StatusAssinatura.ATIVA },
    }),
  ]);

  return { dataFimAcesso: novaDataFim };
}

// --- Webhook Asaas ---

export async function confirmarPagamentoWebhook(payload: asaasService.AsaasWebhookPayload): Promise<void> {
  if (payload.event !== 'PAYMENT_CONFIRMED' && payload.event !== 'PAYMENT_RECEIVED') return;
  const pagamento = payload.payment;
  if (!pagamento?.subscription) return;

  const assinatura = await prisma.assinatura.findFirst({
    where: {
      OR: [{ asaas_subscription_id: pagamento.subscription }, { asaas_customer_id: pagamento.customer }],
    },
    include: { plano: true },
  });
  if (!assinatura) return;

  const agora = new Date();
  // Mesma regra do pagamento manual: só "empilha" em cima do vencimento atual se já era
  // assinante pago renovando — a primeira cobrança de quem ainda estava em TRIAL substitui
  // o trial, não soma a ele.
  const base = assinatura.status === StatusAssinatura.ATIVA && assinatura.data_fim_acesso > agora
    ? assinatura.data_fim_acesso
    : agora;
  const novaDataFim = somarDias(base, 30); // ciclo mensal

  await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        assinatura_id: assinatura.id,
        metodo: MetodoPagamento.GATEWAY_ASAAS,
        valor: pagamento.value,
        periodo_inicio: base,
        periodo_fim: novaDataFim,
        asaas_payment_id: pagamento.id,
      },
    }),
    prisma.assinatura.update({
      where: { id: assinatura.id },
      data: {
        data_fim_acesso: novaDataFim,
        status: StatusAssinatura.ATIVA,
        asaas_subscription_id: assinatura.asaas_subscription_id ?? pagamento.subscription,
      },
    }),
  ]);
}

// --- Webhook Mercado Pago (spec 25) ---

export async function confirmarPagamentoWebhookMercadoPago(paymentId: string): Promise<void> {
  const pagamento = await mercadopagoService.buscarPagamento(paymentId);
  if (pagamento.status !== 'approved') return;
  if (!pagamento.external_reference) return;

  // Idempotência: essa função pode ser chamada mais de uma vez pro mesmo pagamento — o
  // Mercado Pago pode reenviar o mesmo webhook, e agora também existe o botão "Já paguei —
  // verificar" (verificarPagamentoPix), que chama isso na hora em vez de só esperar o
  // webhook. Sem essa checagem, cada chamada extra duplicava o Pagamento e estendia
  // `data_fim_acesso` de novo (bug em potencial, achado ao desenhar o botão de verificar).
  const jaProcessado = await prisma.pagamento.findFirst({ where: { mp_payment_id: pagamento.id } });
  if (jaProcessado) return;

  // `external_reference` é o id da própria Assinatura, gravado na criação da cobrança/
  // assinatura em `iniciarCheckout` — não precisa de customer id como no Asaas.
  const assinatura = await prisma.assinatura.findUnique({
    where: { id: pagamento.external_reference },
  });
  if (!assinatura) return;

  const agora = new Date();
  const base = assinatura.status === StatusAssinatura.ATIVA && assinatura.data_fim_acesso > agora
    ? assinatura.data_fim_acesso
    : agora;
  const dias = assinatura.ciclo === CicloAssinatura.ANUAL ? 365 : 30;
  const novaDataFim = somarDias(base, dias);
  const metodo = pagamento.payment_type_id === 'credit_card' ? MetodoPagamento.GATEWAY_MP_CARTAO : MetodoPagamento.GATEWAY_MP_PIX;

  await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        assinatura_id: assinatura.id,
        metodo,
        valor: pagamento.transaction_amount,
        periodo_inicio: base,
        periodo_fim: novaDataFim,
        mp_payment_id: pagamento.id,
      },
    }),
    prisma.assinatura.update({
      where: { id: assinatura.id },
      data: { data_fim_acesso: novaDataFim, status: StatusAssinatura.ATIVA },
    }),
  ]);
}

// Botão "Já paguei — verificar" (inspirado num concorrente, ver docs/specs/25): checagem
// ativa do pagador em vez de só esperar o webhook em silêncio — útil se o webhook atrasar
// ou falhar. Reaproveita `confirmarPagamentoWebhookMercadoPago`, que agora é idempotente.
export async function verificarPagamentoPix(
  usuarioId: string,
  paymentId: string
): Promise<{ erro: 'ASSINATURA_NAO_ENCONTRADA' } | { pagamentoStatus: string; vencida: boolean; dataFimAcesso: Date }> {
  const pagamento = await mercadopagoService.buscarPagamento(paymentId);
  if (pagamento.status === 'approved') {
    await confirmarPagamentoWebhookMercadoPago(paymentId);
  }

  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  return {
    pagamentoStatus: pagamento.status,
    vencida: assinatura.data_fim_acesso < new Date(),
    dataFimAcesso: assinatura.data_fim_acesso,
  };
}
