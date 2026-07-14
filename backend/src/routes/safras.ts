import { Router } from 'express';
import * as safrasController from '../controllers/safras.controller';
import * as despesasController from '../controllers/despesas.controller';
import * as despesasPessoaisController from '../controllers/despesasPessoais.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.patch('/:id/encerrar', safrasController.encerrar);
router.post('/:id/despesas', despesasController.criar);
router.get('/:id/despesas', despesasController.listar);
router.post('/:id/despesas-pessoais', despesasPessoaisController.criar);
router.get('/:id/despesas-pessoais', despesasPessoaisController.listar);

export default router;
