import { Request, Response } from 'express';
import * as mercadopagoService from '../services/mercadopago.service';
import * as assinaturaService from '../services/assinatura.service';

// Pública (sem authMiddleware) — validada por um token na query string do notification_url
// configurado na preferência/assinatura criada em iniciarCheckout (ver mercadopago.service.ts
// sobre por que não é a validação nativa por assinatura HMAC do Mercado Pago). Sempre responde
// 200, mesmo em eventos ignorados, pra evitar retentativa desnecessária.
export async function receber(req: Request, res: Response): Promise<void> {
  const tokenRecebido = req.query.token as string | undefined;
  if (!mercadopagoService.validarTokenWebhook(tokenRecebido)) {
    res.status(401).json({});
    return;
  }

  const paymentId = mercadopagoService.extrairPaymentIdDoWebhook(req.query as Record<string, unknown>);
  if (!paymentId) {
    res.json({});
    return;
  }

  await assinaturaService.confirmarPagamentoWebhookMercadoPago(paymentId);
  res.json({});
}
