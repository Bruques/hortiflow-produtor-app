import { Router } from 'express';
import * as acertosController from '../controllers/acertos.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/:id', acertosController.detalhar);

export default router;
