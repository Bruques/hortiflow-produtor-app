import { MetodoPagamento, StatusAssinatura, StatusSafra } from '@prisma/client';
import prisma from '../lib/prisma';
import * as asaasService from './asaas.service';

const TRIAL_DIAS = Number(process.env.TRIAL_DIAS || 14);

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
          nome: assinatura.plano.nome,
          valorMensal: Number(assinatura.plano.valor_mensal),
          limiteSafrasAtivas: assinatura.plano.limite_safras_ativas,
        }
      : null,
    status: assinatura.status,
    dataFimAcesso: assinatura.data_fim_acesso,
    vencida: assinatura.data_fim_acesso < new Date(),
    safrasAtivas: emAndamento,
    podeCancelar: !!assinatura.asaas_subscription_id && assinatura.status === StatusAssinatura.ATIVA,
  };
}

type CancelarResultado = { erro: 'SEM_ASSINATURA_ATIVA' } | { dataFimAcesso: Date };

export async function cancelarAssinaturaDoUsuario(usuarioId: string): Promise<CancelarResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura?.asaas_subscription_id) {
    return { erro: 'SEM_ASSINATURA_ATIVA' };
  }

  await asaasService.cancelarAssinatura(assinatura.asaas_subscription_id);

  const atualizada = await prisma.assinatura.update({
    where: { usuario_id: usuarioId },
    data: { status: StatusAssinatura.CANCELADA },
  });

  return { dataFimAcesso: atualizada.data_fim_acesso };
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
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };
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
