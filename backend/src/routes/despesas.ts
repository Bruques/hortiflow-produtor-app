import { Router } from 'express';
import * as despesasController from '../controllers/despesas.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/compartilhada', despesasController.criarCompartilhada);

export default router;
