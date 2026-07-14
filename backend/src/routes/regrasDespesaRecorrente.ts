import { Router } from 'express';
import * as regrasController from '../controllers/regrasDespesaRecorrente.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.patch('/:id', regrasController.atualizarAtivo);

export default router;
