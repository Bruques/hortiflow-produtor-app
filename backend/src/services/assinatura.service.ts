import { CicloAssinatura, FaixaMeeiros, LocalizacaoProducao, MetodoPagamento, StatusAssinatura, StatusSafra, StatusUsuario } from '@prisma/client';
import prisma from '../lib/prisma';
import * as asaasService from './asaas.service';
import * as mercadopagoService from './mercadopago.service';
import { calcularValorCobranca, Desconto } from '../lib/desconto';
import { registrarEvento } from './auditoria.service';

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
export function limiteEfetivo(assinatura: { limite_safras_ativas_override: number | null; plano: { limite_safras_ativas: number | null } | null }): number | null {
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

// Spec 27 — versão em lote de acessoLiberadoParaTitular, para rotas que precisam checar vários
// titulares de uma vez (ex.: lista de safras/resumo consolidado do usuário, que pode abranger
// sociedades de titulares diferentes) sem fazer uma query por titular.
export async function titularesLiberados(titularIds: string[]): Promise<Set<string>> {
  const unicos = [...new Set(titularIds)];
  if (unicos.length === 0) return new Set();

  const assinaturas = await prisma.assinatura.findMany({
    where: { usuario_id: { in: unicos } },
    select: { usuario_id: true, data_fim_acesso: true },
  });

  const agora = new Date();
  return new Set(
    assinaturas
      .filter((a): a is typeof a & { usuario_id: string } => a.usuario_id !== null && a.data_fim_acesso >= agora)
      .map((a) => a.usuario_id)
  );
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
      // Já grava o plano recomendado aqui, não só na confirmação da tela seguinte (bug
      // encontrado no uso real, 2026-09-15): sem isso, quem respondia o formulário mas saía
      // antes de confirmar um plano ficava com `plano_id` nulo — e `limiteEfetivo` trata
      // plano nulo como SEM LIMITE de safras ativas, então o trial ficava ilimitado até o
      // produtor eventualmente confirmar (ou nunca confirmar) um plano. Definir aqui garante
      // que o trial sempre respeita o limite de algum plano real desde a primeira resposta.
      // A tela de plano (`escolherPlano`) continua podendo sobrescrever se o produtor trocar.
      plano_id: plano.id,
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

type CobrancaCriada =
  | { tipo: 'COBRANCA_UNICA'; mpPaymentId: string; initPoint: string }
  | { tipo: 'PIX'; mpOrderId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string };

type CheckoutResultado =
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'PLANO_NAO_ENCONTRADO' }
  | CobrancaCriada;

// Cria a cobrança no Mercado Pago e grava plano/ciclo na Assinatura. Compartilhado entre o
// checkout do próprio produtor (`iniciarCheckout`) e a cobrança gerada pelo dono no painel
// admin (`gerarCobrancaAdmin`, spec 28) — a única diferença entre os dois é quem decide o
// `valor` (tabela do plano vs. tabela com desconto). O ciclo fica gravado porque é ele que
// diz ao webhook quantos dias liberar (30 ou 365) quando o pagamento for confirmado.
async function criarCobrancaNoGateway(params: {
  assinaturaId: string;
  usuarioId: string;
  plano: { id: string; nome: string };
  ciclo: CicloAssinatura;
  metodo: 'CARTAO' | 'PIX';
  valor: number;
  urls: { callbackUrl: string; notificationUrl: string };
}): Promise<CobrancaCriada> {
  const { assinaturaId, usuarioId, plano, ciclo, metodo, valor, urls } = params;
  const cicloTexto = ciclo === CicloAssinatura.ANUAL ? 'anual' : 'mensal';
  const descricao = `HortiFlow — ${plano.nome} (${cicloTexto})`;

  // Pix usa a API de Orders (sem redirecionar, sem exigir conta Mercado Pago do pagador) —
  // ver aviso no topo de mercadopago.service.ts sobre o caminho até chegar nessa solução.
  if (metodo === 'PIX') {
    const pedido = await mercadopagoService.criarPedidoPix({
      usuarioId,
      descricao,
      valor,
      externalReference: assinaturaId,
    });
    await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { plano_id: plano.id, ciclo } });
    return {
      tipo: 'PIX',
      mpOrderId: pedido.orderId,
      qrCode: pedido.qrCode,
      qrCodeBase64: pedido.qrCodeBase64,
      dataExpiracao: pedido.dataExpiracao,
    };
  }

  // Cartão (mensal ou anual) é sempre cobrança única via Checkout Pro. Cartão mensal como
  // assinatura recorrente de verdade (débito automático via `/preapproval`) foi tentado duas
  // vezes (2026-09-15 e 2026-09-16, abordagens diferentes) e falhou nas duas — ver "Perguntas
  // em aberto" na spec 25 pro histórico completo. `criarAssinaturaRecorrente` continua
  // existindo em mercadopago.service.ts (não deletada), caso valha reativar no futuro.
  const { preferenceId, initPoint } = await mercadopagoService.criarCobrancaUnicaCartao({
    usuarioId,
    descricao,
    valor,
    externalReference: assinaturaId,
    callbackUrl: urls.callbackUrl,
    notificationUrl: urls.notificationUrl,
  });
  await prisma.assinatura.update({ where: { usuario_id: usuarioId }, data: { plano_id: plano.id, ciclo } });
  return { tipo: 'COBRANCA_UNICA', mpPaymentId: preferenceId, initPoint };
}

export async function iniciarCheckout(
  usuarioId: string,
  dados: { planoId: string; ciclo: CicloAssinatura; metodo: 'CARTAO' | 'PIX' },
  urls: { callbackUrl: string; notificationUrl: string }
): Promise<CheckoutResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const plano = await prisma.plano.findUnique({ where: { id: dados.planoId } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  const valor = dados.ciclo === CicloAssinatura.ANUAL ? Number(plano.valor_anual) : Number(plano.valor_mensal);
  return criarCobrancaNoGateway({
    assinaturaId: assinatura.id,
    usuarioId,
    plano,
    ciclo: dados.ciclo,
    metodo: dados.metodo,
    valor,
    urls,
  });
}

// --- Admin ---

export async function listarPlanos() {
  const planos = await prisma.plano.findMany({ orderBy: { valor_mensal: 'asc' } });
  return planos.map((p) => ({
    id: p.id,
    nome: p.nome,
    valorMensal: Number(p.valor_mensal),
    // Spec 28 — o painel de cobrança mostra o valor final (com desconto) antes de gerar.
    valorAnual: Number(p.valor_anual),
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
  dados: { valor: number; metodo: Extract<MetodoPagamento, 'MANUAL_PIX' | 'MANUAL_DINHEIRO' | 'MANUAL_CORTESIA'>; dias: number },
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

// --- Spec 28: painel do dono ---

type CobrancaAdminResultado =
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'PLANO_NAO_ENCONTRADO' }
  | { erro: 'DESCONTO_INVALIDO' | 'VALOR_FINAL_ABAIXO_DO_MINIMO' }
  | { tipo: 'PIX'; valorBase: number; valorFinal: number; mpOrderId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string }
  | { tipo: 'CARTAO'; valorBase: number; valorFinal: number; linkPagamento: string };

// Cobrança gerada pelo dono pra um produtor, com desconto opcional. O desconto só existe
// aqui, no cálculo do valor da cobrança: o Pagamento gravado depois (webhook) guarda o valor
// efetivamente pago, então receita e histórico já refletem o desconto sem campo novo.
export async function gerarCobrancaAdmin(
  usuarioId: string,
  dados: { planoId: string; ciclo: CicloAssinatura; metodo: 'CARTAO' | 'PIX'; desconto?: Desconto },
  urls: { callbackUrl: string; notificationUrl: string }
): Promise<CobrancaAdminResultado> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const plano = await prisma.plano.findUnique({ where: { id: dados.planoId } });
  if (!plano) return { erro: 'PLANO_NAO_ENCONTRADO' };

  const precoBase = dados.ciclo === CicloAssinatura.ANUAL ? Number(plano.valor_anual) : Number(plano.valor_mensal);
  const calculo = calcularValorCobranca(precoBase, dados.desconto);
  // Validação antes de qualquer chamada ao Mercado Pago: desconto inválido não cria nada lá.
  if ('erro' in calculo) return calculo;

  const cobranca = await criarCobrancaNoGateway({
    assinaturaId: assinatura.id,
    usuarioId,
    plano,
    ciclo: dados.ciclo,
    metodo: dados.metodo,
    valor: calculo.valorFinal,
    urls,
  });

  if (cobranca.tipo === 'PIX') {
    return {
      tipo: 'PIX',
      valorBase: calculo.valorBase,
      valorFinal: calculo.valorFinal,
      mpOrderId: cobranca.mpOrderId,
      qrCode: cobranca.qrCode,
      qrCodeBase64: cobranca.qrCodeBase64,
      dataExpiracao: cobranca.dataExpiracao,
    };
  }
  return { tipo: 'CARTAO', valorBase: calculo.valorBase, valorFinal: calculo.valorFinal, linkPagamento: cobranca.initPoint };
}

// Rede de segurança do "verificar pagamento": o webhook normalmente confirma sozinho, isso
// só cobre atraso/falha dele. Reaproveita a confirmação idempotente do webhook. Confere que o
// pedido pertence a esta assinatura pra o dono não confirmar, por engano, o Pix de outra pessoa.
export async function verificarPixAdmin(
  usuarioId: string,
  orderId: string
): Promise<
  | { erro: 'ASSINATURA_NAO_ENCONTRADA' }
  | { erro: 'PEDIDO_DE_OUTRA_ASSINATURA' }
  | { pedidoStatus: string; pago: boolean; dataFimAcesso: Date }
> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  const pedido = await mercadopagoService.buscarPedido(orderId);
  if (pedido.externalReference !== assinatura.id) return { erro: 'PEDIDO_DE_OUTRA_ASSINATURA' };

  const pago = pedido.status === 'processed';
  if (pago) await confirmarPedidoPixWebhookMercadoPago(orderId);

  const atualizada = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  return { pedidoStatus: pedido.status, pago, dataFimAcesso: atualizada!.data_fim_acesso };
}

// Cancelar pelo painel NÃO corta o acesso: só marca a assinatura como cancelada e encerra a
// recorrência no gateway, se houver. Quem decide o acesso é `data_fim_acesso` (spec 18), que
// aqui não é tocada — o produtor usa até o fim do que já pagou. Pra cortar na hora, o dono
// usa o bloqueio. Diferente de `cancelarAssinaturaDoUsuario` (o produtor cancelando a si
// mesmo), aceita assinatura sem recorrência, que é o caso comum com Pix/cartão avulsos.
export async function cancelarAssinaturaAdmin(
  usuarioId: string
): Promise<{ erro: 'ASSINATURA_NAO_ENCONTRADA' } | { status: StatusAssinatura; dataFimAcesso: Date }> {
  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  if (assinatura.mp_preapproval_id) {
    await mercadopagoService.cancelarAssinatura(assinatura.mp_preapproval_id);
  } else if (assinatura.asaas_subscription_id) {
    await asaasService.cancelarAssinatura(assinatura.asaas_subscription_id);
  }

  const atualizada = await prisma.assinatura.update({
    where: { usuario_id: usuarioId },
    data: { status: StatusAssinatura.CANCELADA },
  });
  return { status: atualizada.status, dataFimAcesso: atualizada.data_fim_acesso };
}

// Bloqueio (spec 16), agora pelo painel em vez de direto no banco. Conta excluída (spec 20)
// não é bloqueável nem desbloqueável: reativá-la por aqui a traria de volta anonimizada.
export async function definirBloqueioUsuario(
  usuarioId: string,
  bloqueado: boolean,
  adminId: string
): Promise<{ erro: 'USUARIO_NAO_ENCONTRADO' } | { erro: 'CONTA_EXCLUIDA' } | { status: StatusUsuario }> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return { erro: 'USUARIO_NAO_ENCONTRADO' };
  if (usuario.status === StatusUsuario.EXCLUIDO) return { erro: 'CONTA_EXCLUIDA' };

  const novoStatus = bloqueado ? StatusUsuario.BLOQUEADO : StatusUsuario.ATIVO;
  if (usuario.status !== novoStatus) {
    await prisma.usuario.update({ where: { id: usuarioId }, data: { status: novoStatus } });
    await registrarEvento(usuarioId, bloqueado ? 'CONTA_BLOQUEADA' : 'CONTA_DESBLOQUEADA', { origem: 'painel_admin', adminId });
  }
  return { status: novoStatus };
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
  // Mercado Pago pode reenviar o mesmo webhook. Sem essa checagem, cada chamada extra
  // duplicava o Pagamento e estendia `data_fim_acesso` de novo.
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

// Pix via API de Orders (ver mercadopago.service.ts) — mesma lógica da confirmação de
// pagamento acima, mas consultando um pedido em vez de um pagamento avulso. `mp_payment_id`
// no `Pagamento` guarda o id do pedido aqui (nome do campo é genérico o bastante).
export async function confirmarPedidoPixWebhookMercadoPago(orderId: string): Promise<void> {
  const pedido = await mercadopagoService.buscarPedido(orderId);
  if (pedido.status !== 'processed') return;
  if (!pedido.externalReference) return;

  const jaProcessado = await prisma.pagamento.findFirst({ where: { mp_payment_id: pedido.id } });
  if (jaProcessado) return;

  const assinatura = await prisma.assinatura.findUnique({ where: { id: pedido.externalReference } });
  if (!assinatura) return;

  const agora = new Date();
  const base = assinatura.status === StatusAssinatura.ATIVA && assinatura.data_fim_acesso > agora
    ? assinatura.data_fim_acesso
    : agora;
  const dias = assinatura.ciclo === CicloAssinatura.ANUAL ? 365 : 30;
  const novaDataFim = somarDias(base, dias);

  await prisma.$transaction([
    prisma.pagamento.create({
      data: {
        assinatura_id: assinatura.id,
        metodo: MetodoPagamento.GATEWAY_MP_PIX,
        valor: pedido.valor,
        periodo_inicio: base,
        periodo_fim: novaDataFim,
        mp_payment_id: pedido.id,
      },
    }),
    prisma.assinatura.update({
      where: { id: assinatura.id },
      data: { data_fim_acesso: novaDataFim, status: StatusAssinatura.ATIVA },
    }),
  ]);
}

// Botão "Já paguei — verificar": checagem ativa do pagador em vez de só esperar o webhook
// em silêncio — rede de segurança enquanto o formato do webhook de pedidos (API de Orders)
// ainda não foi validado contra um evento real. Reaproveita `confirmarPedidoPixWebhookMercadoPago`,
// que é idempotente.
export async function verificarPedidoPix(
  usuarioId: string,
  orderId: string
): Promise<{ erro: 'ASSINATURA_NAO_ENCONTRADA' } | { pedidoStatus: string; vencida: boolean; dataFimAcesso: Date }> {
  const pedido = await mercadopagoService.buscarPedido(orderId);
  if (pedido.status === 'processed') {
    await confirmarPedidoPixWebhookMercadoPago(orderId);
  }

  const assinatura = await prisma.assinatura.findUnique({ where: { usuario_id: usuarioId } });
  if (!assinatura) return { erro: 'ASSINATURA_NAO_ENCONTRADA' };

  return {
    pedidoStatus: pedido.status,
    vencida: assinatura.data_fim_acesso < new Date(),
    dataFimAcesso: assinatura.data_fim_acesso,
  };
}
