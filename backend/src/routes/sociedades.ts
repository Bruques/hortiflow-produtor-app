import { Router } from 'express';
import * as sociedadesController from '../controllers/sociedades.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', sociedadesController.criar);
router.post('/entrar', sociedadesController.entrar);
router.get('/', sociedadesController.listar);
router.get('/:id/socios', sociedadesController.listarSocios);
router.put('/:id/socios/percentuais', sociedadesController.atualizarPercentuais);

export default router;
