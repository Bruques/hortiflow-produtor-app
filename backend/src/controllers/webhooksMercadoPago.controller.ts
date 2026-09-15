import { Request, Response } from 'express';
import * as mercadopagoService from '../services/mercadopago.service';
import * as assinaturaService from '../services/assinatura.service';

// Pública (sem authMiddleware) — validada por um token na query string do notification_url
// configurado no painel do Mercado Pago (Notificações → Webhooks, tópicos "Pagamentos
// (legacy)" e "Order (Mercado Pago)" — ver mercadopago.service.ts sobre por que não é a
// validação nativa por assinatura HMAC do Mercado Pago). Sempre responde 200, mesmo em
// eventos ignorados, pra evitar retentativa desnecessária.
//
// Formato confirmado contra webhook real em 2026-09-15: `type=order` pra pedidos Pix,
// `type=payment` pra cartão — os dois já tratados por extrairNotificacaoWebhook.
export async function receber(req: Request, res: Response): Promise<void> {
  const tokenRecebido = req.query.token as string | undefined;
  if (!mercadopagoService.validarTokenWebhook(tokenRecebido)) {
    res.status(401).json({});
    return;
  }

  const notificacao = mercadopagoService.extrairNotificacaoWebhook(req.query as Record<string, unknown>);
  if (!notificacao) {
    res.json({});
    return;
  }

  if (notificacao.tipo === 'payment') {
    await assinaturaService.confirmarPagamentoWebhookMercadoPago(notificacao.id);
  } else {
    await assinaturaService.confirmarPedidoPixWebhookMercadoPago(notificacao.id);
  }

  res.json({});
}
