import { Router } from 'express';
import * as webhooksAsaasController from '../controllers/webhooksAsaas.controller';

// Pública de propósito — sem authMiddleware. O Asaas chama isso direto, autenticado só
// pelo token de webhook (ver webhooksAsaas.controller.ts), não por JWT do app.
const router = Router();

router.post('/', webhooksAsaasController.receber);

export default router;
