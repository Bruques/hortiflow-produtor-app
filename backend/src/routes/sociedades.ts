import { Router } from 'express';
import * as sociedadesController from '../controllers/sociedades.controller';
import * as safrasController from '../controllers/safras.controller';
import * as regrasController from '../controllers/regrasDespesaRecorrente.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', sociedadesController.criar);
router.post('/entrar', sociedadesController.entrar);
router.get('/', sociedadesController.listar);
router.get('/:id/socios', sociedadesController.listarSocios);
router.put('/:id/socios/percentuais', sociedadesController.atualizarPercentuais);
router.post('/:id/safras', safrasController.abrir);
router.get('/:id/safras', safrasController.listar);
router.post('/:id/regras-recorrentes', regrasController.criar);
router.get('/:id/regras-recorrentes', regrasController.listar);

export default router;
