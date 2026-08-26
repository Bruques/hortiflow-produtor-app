import { Request, Response } from 'express';
import * as asaasService from '../services/asaas.service';
import * as assinaturaService from '../services/assinatura.service';

// Pública (sem authMiddleware) — validada pelo token de webhook do Asaas, enviado no header
// `asaas-access-token` configurado no painel deles. Sempre responde 200, mesmo em eventos
// ignorados, pra evitar retentativa desnecessária do Asaas.
export async function receber(req: Request, res: Response): Promise<void> {
  const tokenRecebido = req.headers['asaas-access-token'] as string | undefined;
  if (!asaasService.validarTokenWebhook(tokenRecebido)) {
    res.status(401).json({});
    return;
  }

  await assinaturaService.confirmarPagamentoWebhook(req.body as asaasService.AsaasWebhookPayload);
  res.json({});
}
