import { Request, Response } from 'express';
import * as mercadopagoService from '../services/mercadopago.service';
import * as assinaturaService from '../services/assinatura.service';

// Pública (sem authMiddleware) — validada por um token na query string do notification_url
// configurado na preferência/assinatura/pedido criado em iniciarCheckout (ver
// mercadopago.service.ts sobre por que não é a validação nativa por assinatura HMAC do
// Mercado Pago). Sempre responde 200, mesmo em eventos ignorados, pra evitar retentativa
// desnecessária.
//
// Loga a notificação bruta (sem dados sensíveis, só query params) — a extração de tipo/id
// pra pedidos Pix (API de Orders) ainda não foi confirmada contra um webhook real; esse log
// é a forma de validar/ajustar os nomes exatos assim que o primeiro Pix real for pago.
export async function receber(req: Request, res: Response): Promise<void> {
  const tokenRecebido = req.query.token as string | undefined;
  if (!mercadopagoService.validarTokenWebhook(tokenRecebido)) {
    res.status(401).json({});
    return;
  }

  console.log('[webhook mercadopago]', JSON.stringify(req.query));

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
