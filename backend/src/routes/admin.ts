import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as adminAuthController from '../controllers/adminAuth.controller';
import { adminAuthMiddleware } from '../middlewares/adminAuth';

const router = Router();

// Login público — sem adminAuthMiddleware, é ele quem gera o token que as rotas abaixo exigem.
router.post('/auth/login', adminAuthController.login);

router.use(adminAuthMiddleware);

router.get('/assinaturas', adminController.listarAssinaturas);
router.get('/planos', adminController.listarPlanos);
router.patch('/assinaturas/:usuarioId/plano', adminController.atribuirPlano);
router.patch('/assinaturas/:usuarioId/limite-safras', adminController.definirLimiteSafras);
router.post('/assinaturas/:usuarioId/checkout-link', adminController.checkoutLink);
router.post('/assinaturas/:usuarioId/pagamento-manual', adminController.pagamentoManual);
router.patch('/planos/:planoId', adminController.editarPlano);

export default router;
