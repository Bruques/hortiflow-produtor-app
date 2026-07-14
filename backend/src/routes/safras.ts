import { Router } from 'express';
import * as safrasController from '../controllers/safras.controller';
import * as despesasController from '../controllers/despesas.controller';
import * as despesasPessoaisController from '../controllers/despesasPessoais.controller';
import * as vendasController from '../controllers/vendas.controller';
import * as regrasController from '../controllers/regrasDespesaRecorrente.controller';
import * as simulacaoController from '../controllers/simulacao.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.patch('/:id/encerrar', safrasController.encerrar);
router.post('/:id/despesas', despesasController.criar);
router.get('/:id/despesas', despesasController.listar);
router.post('/:id/despesas-pessoais', despesasPessoaisController.criar);
router.get('/:id/despesas-pessoais', despesasPessoaisController.listar);
router.post('/:id/vendas', vendasController.criar);
router.get('/:id/vendas', vendasController.listar);
router.get('/:id/regras-recorrentes/sugestoes', regrasController.sugestoes);
router.post('/:id/regras-recorrentes/:regraId/confirmar', regrasController.confirmar);
router.get('/:id/simulacao', simulacaoController.simular);

export default router;
