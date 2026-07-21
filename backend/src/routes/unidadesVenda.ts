import { Router } from 'express';
import * as unidadesController from '../controllers/unidadesVenda.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.patch('/:id', unidadesController.atualizarAtivo);

export default router;
