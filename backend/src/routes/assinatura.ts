import { Router } from 'express';
import * as assinaturaController from '../controllers/assinatura.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/status', assinaturaController.status);
router.post('/cancelar', assinaturaController.cancelar);
router.get('/planos', assinaturaController.listarPlanos);
router.post('/onboarding', assinaturaController.onboarding);
router.patch('/plano', assinaturaController.escolherPlano);
router.post('/checkout', assinaturaController.checkout);
router.get('/checkout/pix/:paymentId/status', assinaturaController.verificarPagamentoPix);

export default router;
