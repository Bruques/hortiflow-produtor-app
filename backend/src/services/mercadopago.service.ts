// Spec 25 — cliente HTTP do Mercado Pago (gateway de cobrança do onboarding automatizado),
// no mesmo padrão do asaas.service.ts: fetch nativo, sem dependência nova.
//
// Testado contra o Mercado Pago de teste (conta sandbox real) em 2026-09-15. Achado nesse
// teste: cartão via Checkout Pro (redirecionamento hospedado) funciona bem, mas o Pix via
// Checkout Pro **exige login numa conta Mercado Pago do pagador** — inaceitável pro nosso
// caso (o pagador não deveria precisar de conta nenhuma). Por isso o Pix NÃO usa Checkout
// Pro: usa a API de Pagamentos direta (`POST /v1/payments`), que devolve um QR Code pra
// mostrar dentro do próprio app, sem redirecionar o pagador pra lugar nenhum.

import { randomUUID } from 'crypto';

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

interface MpPreference {
  id: string;
  init_point: string;
}

// Cobrança única, hospedada (Checkout Pro) — só sobrou o caso cartão + anual (Pix não usa
// mais isso, ver criarPagamentoPix abaixo). Ainda assim exclui explicitamente boleto/Pix/
// caixa eletrônico da preferência, pra garantir que só cartão apareça nessa tela.
// https://www.mercadopago.com.br/developers — payment_methods.excluded_payment_types
export async function criarCobrancaUnicaCartao(params: {
  usuarioId: string;
  descricao: string;
  valor: number;
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
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }, { id: 'prepaid_card' }],
      },
    }),
  });

  return {
    preferenceId: preference.id,
    // Quem decide se é um pagamento de teste ou real são as credenciais usadas (o
    // MP_ACCESS_TOKEN), não a URL — por isso um único link (`init_point`) serve pros dois casos.
    initPoint: preference.init_point,
  };
}

interface MpPagamentoPixCriado {
  id: number;
  status: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string; // "copia e cola"
      qr_code_base64?: string; // imagem do QR Code, já em base64 (sem o prefixo data:image/...)
    };
  };
}

const PIX_MINUTOS_EXPIRACAO = 30;

// Pix direto via API de Pagamentos — sem redirecionar o pagador, sem exigir conta/login no
// Mercado Pago (ver aviso no topo do arquivo). CPF é opcional: testado em 2026-09-15 sem
// CPF nenhum e o Mercado Pago aceitou normalmente — a documentação sugeria ser obrigatório,
// mas na prática não é (bate com concorrentes que também não pedem). Se um dia a API passar
// a exigir de verdade, o erro que ela devolve é específico o bastante pra tratar depois.
export async function criarPagamentoPix(params: {
  usuarioId: string;
  descricao: string;
  valor: number;
  cpf?: string;
  externalReference: string;
  notificationUrl: string;
}): Promise<{ paymentId: string; status: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string }> {
  const expiracao = new Date(Date.now() + PIX_MINUTOS_EXPIRACAO * 60 * 1000);
  const cpfDigitos = params.cpf?.replace(/\D/g, '');

  const pagamento = await mpFetch<MpPagamentoPixCriado>('/v1/payments', {
    method: 'POST',
    // Idempotency key: evita criar dois pagamentos Pix se a chamada for repetida (ex: o app
    // reenviar por instabilidade de rede) — cada tentativa de checkout gera uma nova, então
    // um duplo toque do usuário no botão ainda cria dois pagamentos distintos de propósito.
    headers: { 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      transaction_amount: params.valor,
      description: params.descricao,
      payment_method_id: 'pix',
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
      date_of_expiration: expiracao.toISOString(),
      payer: {
        email: emailSinteticoPara(params.usuarioId),
        ...(cpfDigitos ? { identification: { type: 'CPF', number: cpfDigitos } } : {}),
      },
    }),
  });

  return {
    paymentId: String(pagamento.id),
    status: pagamento.status,
    qrCode: pagamento.point_of_interaction?.transaction_data?.qr_code ?? '',
    qrCodeBase64: pagamento.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
    dataExpiracao: pagamento.date_of_expiration ?? expiracao.toISOString(),
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
