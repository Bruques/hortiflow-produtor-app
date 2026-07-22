import { Router } from 'express';
import { register, login, me, trocarSenha } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.put('/senha', authMiddleware, trocarSenha);

export default router;
