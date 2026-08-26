// Spec 18 — cliente HTTP do Asaas (gateway de cobrança). Usa o `fetch` nativo do
// Node (20+), sem adicionar axios/dependência nova só pra isso.

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

function headers() {
  return {
    'Content-Type': 'application/json',
    access_token: process.env.ASAAS_API_KEY || '',
  };
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${ASAAS_API_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  const corpo = await resposta.json();
  if (!resposta.ok) {
    throw new Error(`Asaas ${path} falhou (${resposta.status}): ${JSON.stringify(corpo)}`);
  }
  return corpo as T;
}

interface AsaasCustomer {
  id: string;
}

export async function criarCustomer(nome: string, telefone: string, cpfCnpj?: string): Promise<string> {
  const customer = await asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: nome, mobilePhone: telefone, cpfCnpj }),
  });
  return customer.id;
}

interface AsaasCheckoutSession {
  id: string;
}

// Cria um checkout hospedado do Asaas com cobrança recorrente mensal (cartão de crédito),
// pro plano já atribuído ao titular. O link é devolvido pro admin copiar e enviar manualmente
// (WhatsApp/e-mail) — ver docs/specs/18-assinatura-e-pagamento.md.
export async function criarCheckoutAssinatura(params: {
  customerId: string;
  descricao: string;
  valorMensal: number;
  callbackUrl: string;
}): Promise<string> {
  const session = await asaasFetch<AsaasCheckoutSession>('/checkoutSessions', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 4320, // 3 dias pra não travar o admin num link vencido
      callback: { successUrl: params.callbackUrl },
      subscription: {
        cycle: 'MONTHLY',
        value: params.valorMensal,
        description: params.descricao,
      },
      items: [{ name: params.descricao, quantity: 1, value: params.valorMensal }],
    }),
  });
  return `https://asaas.com/checkoutSession/show?id=${session.id}`;
}

export async function cancelarAssinatura(asaasSubscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${asaasSubscriptionId}`, { method: 'DELETE' });
}

// Payload mínimo do webhook de cobrança do Asaas (evento `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`).
// Ver https://docs.asaas.com para o formato completo — só os campos usados aqui.
export interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    customer: string;
    value: number;
  };
}

export function validarTokenWebhook(tokenRecebido: string | undefined): boolean {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  return !!tokenEsperado && tokenRecebido === tokenEsperado;
}
