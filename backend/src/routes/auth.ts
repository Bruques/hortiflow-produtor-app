import { Router } from 'express';
import { register, login, logout, me, trocarSenha } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
router.put('/senha', authMiddleware, trocarSenha);

export default router;
