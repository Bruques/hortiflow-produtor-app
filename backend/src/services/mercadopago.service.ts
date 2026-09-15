// Spec 25 — cliente HTTP do Mercado Pago (gateway de cobrança do onboarding automatizado),
// no mesmo padrão do asaas.service.ts: fetch nativo, sem dependência nova.
//
// Testado contra o Mercado Pago de teste (conta sandbox real) em 2026-09-15. Cartão continua
// pelo Checkout Pro (redirecionamento hospedado, `/checkout/preferences`) — funciona bem,
// sem exigir conta do pagador. Pix tentou o mesmo caminho primeiro, mas o Checkout Pro exige
// login numa conta Mercado Pago pra pagar via Pix especificamente (cartão não tem essa
// exigência ali). Tentamos então a API de Pagamentos direta (`/v1/payments`), mas essa conta
// bate em "Unauthorized use of live credentials" em toda tentativa de criar um pagamento por
// ela, sem causa identificada. A solução que funcionou: a **API de Orders** (`/v1/orders`,
// mais nova, a que o próprio Mercado Pago recomenda) — gera o Pix (QR Code + copia-e-cola)
// sem pedir login nenhum, testado com sucesso. Único requisito extra encontrado: em modo
// sandbox, o e-mail do pagador precisa terminar em `@testuser.com` (erro `invalid_email_
// for_sandbox`) — assumimos que isso não se aplica com credenciais de produção de verdade,
// mas não dá pra confirmar sem uma conta real.

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

// As APIs mais novas do Mercado Pago (Orders, usada pro Pix; Preapproval, usada pra
// assinatura recorrente mensal) exigem, em modo sandbox, que o e-mail do pagador seja de um
// usuário real ou de teste de verdade — o e-mail sintético normal é recusado (`invalid_
// email_for_sandbox` na de Orders, "Both payer and collector must be real or test users" na
// de Preapproval — achados em teste real 2026-09-15). Restrição que não existe com
// credenciais de produção. MP_SANDBOX_PAYER_EMAIL permite configurar um e-mail de usuário de
// teste válido só nos ambientes de teste (local/staging), sem mexer no comportamento de
// produção, onde essa env não deve ser setada. Checkout Pro (Preferences — cartão anual e a
// preferência de cartão) não tem essa exigência, por isso continua usando o e-mail sintético.
function emailPagadorSandbox(usuarioId: string): string {
  return process.env.MP_SANDBOX_PAYER_EMAIL || emailSinteticoPara(usuarioId);
}

interface MpPreference {
  id: string;
  init_point: string;
}

// Cobrança única, hospedada (Checkout Pro) — só cartão (anual). Exclui explicitamente
// boleto/Pix/caixa eletrônico da preferência, pra garantir que só cartão apareça nessa tela.
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

interface MpOrder {
  id: string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  total_amount: string;
  transactions?: {
    payments?: Array<{
      id: string;
      status: string;
      date_of_expiration?: string;
      payment_method?: {
        qr_code?: string; // "copia e cola"
        qr_code_base64?: string; // imagem do QR Code, já em base64 (sem o prefixo data:image/...)
      };
    }>;
  };
}

// Pix via API de Orders (não a de Pagamentos legada, ver aviso no topo do arquivo) — sem
// redirecionar o pagador, sem exigir conta/login no Mercado Pago. `status: "processed"` é o
// estado final de "pago" (confirmado via GET, ver buscarPedido).
//
// Sem `notification_url` no corpo — a API de Orders não aceita esse campo por requisição
// (erro `unsupported_properties`, achado em teste real 2026-09-15); webhook por pedido
// precisa ser configurado a nível de aplicação no painel do Mercado Pago (tópico
// merchant_order/order), não por chamada. Enquanto isso não é configurado, o botão "Já
// paguei — verificar" é o único jeito de confirmar o pagamento — não é só uma rede de
// segurança, é a via principal até o webhook de pedido ser configurado.
export async function criarPedidoPix(params: {
  usuarioId: string;
  descricao: string;
  valor: number;
  externalReference: string;
}): Promise<{ orderId: string; qrCode: string; qrCodeBase64: string; dataExpiracao: string }> {
  const valorFormatado = params.valor.toFixed(2);

  const pedido = await mpFetch<MpOrder>('/v1/orders', {
    method: 'POST',
    // Idempotency key: evita criar duas ordens Pix se a chamada for repetida (ex: o app
    // reenviar por instabilidade de rede) — cada tentativa de checkout gera uma nova, então
    // um duplo toque do usuário no botão ainda cria duas ordens distintas de propósito.
    headers: { 'X-Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      type: 'online',
      total_amount: valorFormatado,
      external_reference: params.externalReference,
      processing_mode: 'automatic',
      payer: {
        email: emailPagadorSandbox(params.usuarioId),
        // "APRO" em first_name é a palavra-mágica de teste do Mercado Pago (mesmo padrão
        // dos cartões de teste): em sandbox, aprova o Pix automaticamente alguns segundos
        // depois de criado, sem precisar escanear o QR de verdade. Só entra quando
        // MP_SANDBOX_PAYER_EMAIL está setado (ambiente de teste) — nunca em produção.
        ...(process.env.MP_SANDBOX_PAYER_EMAIL ? { first_name: 'APRO' } : {}),
      },
      transactions: {
        payments: [{ amount: valorFormatado, payment_method: { id: 'pix', type: 'bank_transfer' } }],
      },
    }),
  });

  const pagamento = pedido.transactions?.payments?.[0];
  return {
    orderId: pedido.id,
    qrCode: pagamento?.payment_method?.qr_code ?? '',
    qrCodeBase64: pagamento?.payment_method?.qr_code_base64 ?? '',
    dataExpiracao: pagamento?.date_of_expiration ?? '',
  };
}

export interface MpOrderStatus {
  id: string;
  status: string;
  externalReference?: string;
  valor: number;
}

export async function buscarPedido(orderId: string): Promise<MpOrderStatus> {
  const pedido = await mpFetch<MpOrder>(`/v1/orders/${orderId}`);
  return {
    id: pedido.id,
    status: pedido.status,
    externalReference: pedido.external_reference,
    valor: Number(pedido.total_amount),
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
      payer_email: emailPagadorSandbox(params.usuarioId),
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

// Bug real encontrado em produção (2026-09-15): a API de Pagamentos devolve `id` como
// NÚMERO no JSON (ex: 178132390917) — diferente da API de Orders (Pix), cujo id já vem como
// string alfanumérica de verdade. O tipo `MpPayment.id: string` era só uma promessa do
// TypeScript, sem conversão em runtime — o `mp_payment_id` (campo `String?` no Prisma)
// quebrava a confirmação do webhook de cartão com "Expected StringNullableFilter... provided
// Int", derrubando a criação do Pagamento sem gerar nenhum erro visível pro produtor (ele só
// via o checkout voltar sem confirmar). Corrigido convertendo pra string aqui, na borda.
export async function buscarPagamento(paymentId: string): Promise<MpPayment> {
  const pagamento = await mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
  return { ...pagamento, id: String(pagamento.id) };
}

// Formato de notificação do Mercado Pago (query string): `?type=payment&data.id=123` pras
// cobranças de cartão (Checkout Pro) e `?type=order&data.id=...` pros pedidos Pix (API de
// Orders) — os dois confirmados contra webhook real em staging (2026-09-15).
//
// `merchant_order` — bug real encontrado em produção (2026-09-15): esse tópico (legado,
// específico do Checkout Pro) chega com um id de outro sistema, não da API de Orders — tratar
// como `tipo: 'order'` fazia `buscarPedido` chamar `/v1/orders/{id do merchant_order}`, que
// sempre falha (`invalid_path_param`), gerando retentativa infinita do Mercado Pago. Como o
// cartão já confirma pelo tópico `payment` e o Pix pelo `order` de verdade, `merchant_order`
// é redundante — ignorado agora (retorna null, webhook responde 200 sem processar nada).
export function extrairNotificacaoWebhook(query: Record<string, unknown>): { tipo: 'payment' | 'order'; id: string } | null {
  const tipoRaw = (query.type ?? query.topic) as string | undefined;
  const id = (query['data.id'] ?? query.id) as string | undefined;
  if (!id) return null;
  if (tipoRaw === 'payment') return { tipo: 'payment', id };
  if (tipoRaw === 'order') return { tipo: 'order', id };
  return null;
}

// Validação simples por token em query string (`?token=...` no notification_url), no mesmo
// espírito do `validarTokenWebhook` do Asaas. O Mercado Pago também oferece validação nativa
// por assinatura HMAC (header `x-signature`) — mais robusta, mas não verificada nesta sessão
// por falta de conta sandbox real; avaliar migrar pra ela antes de produção.
export function validarTokenWebhook(tokenRecebido: string | undefined): boolean {
  const tokenEsperado = process.env.MP_WEBHOOK_TOKEN;
  return !!tokenEsperado && tokenRecebido === tokenEsperado;
}
