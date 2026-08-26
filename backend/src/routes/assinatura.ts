import { Router } from 'express';
import * as assinaturaController from '../controllers/assinatura.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/status', assinaturaController.status);
router.post('/cancelar', assinaturaController.cancelar);

export default router;
