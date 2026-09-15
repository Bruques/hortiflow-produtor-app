import { Router } from 'express';
import * as webhooksMercadoPagoController from '../controllers/webhooksMercadoPago.controller';

// Pública de propósito — sem authMiddleware. O Mercado Pago chama isso direto, autenticado
// só pelo token na query string (ver webhooksMercadoPago.controller.ts), não por JWT do app.
const router = Router();

router.post('/', webhooksMercadoPagoController.receber);

export default router;
