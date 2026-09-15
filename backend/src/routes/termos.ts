import { Router } from 'express';
import * as termosController from '../controllers/termos.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/status', termosController.status);
router.post('/aceite', termosController.aceite);

export default router;
