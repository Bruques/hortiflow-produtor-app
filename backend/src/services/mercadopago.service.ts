// Spec 25 — cliente HTTP do Mercado Pago (gateway de cobrança do onboarding automatizado),
// no mesmo padrão do asaas.service.ts: fetch nativo, sem dependência nova.
//
// AVISO IMPORTANTE: este arquivo foi escrito a partir da documentação pública do Mercado
// Pago (Checkout Pro / Preferences e Assinaturas / Preapproval), mas não foi testado contra
// uma conta sandbox real nesta sessão (sem credenciais disponíveis). Antes de ir pra produção,
// validar cada chamada com o `MP_ACCESS_TOKEN` de teste do Mercado Pago e conferir o formato
// exato do payload de webhook que a conta realmente envia.

const MP_API_URL = process.env.MP_API_URL || 'https://api.mercadopago.com';

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN || ''}`,
  };
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${MP_API_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  const corpo = await resposta.json();
  if (!resposta.ok) {
    throw new Error(`Mercado Pago ${path} falhou (${resposta.status}): ${JSON.stringify(corpo)}`);
  }
  return corpo as T;
}

// O Usuario do HortiFlow Produtor não tem e-mail (login é por telefone — ver CLAUDE.md), mas
// as APIs de cobrança do Mercado Pago exigem um payer_email. Sintetizamos um a partir do id,
// só pra satisfazer o contrato da API — nunca é enviado nem usado como e-mail de contato real.
function emailSinteticoPara(usuarioId: string): string {
  return `${usuarioId}@usuarios.hortiflow-produtor.com.br`;
}

type Metodo = 'CARTAO' | 'PIX';

// Tipos de pagamento do Mercado Pago a excluir da preferência pra forçar só cartão ou só Pix.
// https://www.mercadopago.com.br/developers — payment_methods.excluded_payment_types
function tiposExcluidosPara(metodo: Metodo): { id: string }[] {
  if (metodo === 'CARTAO') {
    return [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }, { id: 'prepaid_card' }];
  }
  return [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'prepaid_card' }, { id: 'ticket' }, { id: 'atm' }];
}

interface MpPreference {
  id: string;
  init_point: string;
}

// Cobrança única, hospedada (Checkout Pro) — usada pra ciclo anual (cartão ou Pix) e pra
// ciclo mensal + Pix (que não tem débito automático, então "assinatura" não se aplica: cada
// cobrança é uma preferência nova). Ver docs/specs/25-onboarding-e-checkout-automatizados.md.
export async function criarCobrancaUnica(params: {
  usuarioId: string;
  descricao: string;
  valor: number;
  metodo: Metodo;
  externalReference: string;
  callbackUrl: string;
  notificationUrl: string;
}): Promise<{ preferenceId: string; initPoint: string }> {
  const preference = await mpFetch<MpPreference>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ title: params.descricao, quantity: 1, unit_price: params.valor, currency_id: 'BRL' }],
      payer: { email: emailSinteticoPara(params.usuarioId) },
      external_reference: params.externalReference,
      back_urls: { success: params.callbackUrl, failure: params.callbackUrl, pending: params.callbackUrl },
      auto_return: 'approved',
      notification_url: params.notificationUrl,
      payment_methods: { excluded_payment_types: tiposExcluidosPara(params.metodo) },
    }),
  });

  return {
    preferenceId: preference.id,
    // Quem decide se é um pagamento de teste ou real são as credenciais usadas (o
    // MP_ACCESS_TOKEN), não a URL — por isso um único link (`init_point`) serve pros dois casos.
    initPoint: preference.init_point,
  };
}

interface MpPreapproval {
  id: string;
  init_point: string;
}

// Assinatura recorrente (Preapproval) — só existe no ciclo mensal + cartão. O produtor
// autoriza o cartão na página hospedada do Mercado Pago; cobranças seguintes são
// automáticas, confirmadas por webhook (igual ao Asaas).
export async function criarAssinaturaRecorrente(params: {
  usuarioId: string;
  descricao: string;
  valorMensal: number;
  externalReference: string;
  callbackUrl: string;
}): Promise<{ preapprovalId: string; initPoint: string }> {
  const preapproval = await mpFetch<MpPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: params.descricao,
      external_reference: params.externalReference,
      payer_email: emailSinteticoPara(params.usuarioId),
      back_url: params.callbackUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.valorMensal,
        currency_id: 'BRL',
      },
      status: 'pending',
    }),
  });

  return { preapprovalId: preapproval.id, initPoint: preapproval.init_point };
}

export async function cancelarAssinatura(preapprovalId: string): Promise<void> {
  await mpFetch(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

export interface MpPayment {
  id: string;
  status: string;
  transaction_amount: number;
  external_reference?: string;
  // 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer' | ... — usado pra saber se a
  // cobrança confirmada foi cartão ou Pix, já que o webhook só manda o id do pagamento.
  payment_type_id?: string;
}

export async function buscarPagamento(paymentId: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
}

// Formato de notificação do Mercado Pago (query string): `?type=payment&data.id=123`.
// Existe um formato mais antigo (`?topic=payment&id=123`) que algumas integrações antigas
// ainda recebem — aceitamos os dois por segurança.
export function extrairPaymentIdDoWebhook(query: Record<string, unknown>): string | null {
  const tipo = (query.type ?? query.topic) as string | undefined;
  if (tipo !== 'payment') return null;
  const id = (query['data.id'] ?? query.id) as string | undefined;
  return id ?? null;
}

// Validação simples por token em query string (`?token=...` no notification_url), no mesmo
// espírito do `validarTokenWebhook` do Asaas. O Mercado Pago também oferece validação nativa
// por assinatura HMAC (header `x-signature`) — mais robusta, mas não verificada nesta sessão
// por falta de conta sandbox real; avaliar migrar pra ela antes de produção.
export function validarTokenWebhook(tokenRecebido: string | undefined): boolean {
  const tokenEsperado = process.env.MP_WEBHOOK_TOKEN;
  return !!tokenEsperado && tokenRecebido === tokenEsperado;
}
