import { Router } from 'express';
import * as despesasPessoaisController from '../controllers/despesasPessoais.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.put('/:id', despesasPessoaisController.atualizar);
router.delete('/:id', despesasPessoaisController.excluir);

export default router;
