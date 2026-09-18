import { Router } from 'express';
import * as despesasPessoaisController from '../controllers/despesasPessoais.controller';
import * as despesasPessoaisService from '../services/despesasPessoais.service';
import { authMiddleware } from '../middlewares/auth';
import { criarGateAssinaturaPorRecurso } from '../middlewares/assinaturaGate';

const router = Router();

router.use(authMiddleware);

// Spec 27 — criar/listar despesa pessoal já são gated (nested em /safras/:id/despesas-pessoais);
// editar/excluir ficavam de fora por serem uma rota à parte, com :id = id da despesa pessoal.
router.use(
  '/:id',
  criarGateAssinaturaPorRecurso(async (id) => {
    const despesa = await despesasPessoaisService.buscarDespesaPessoal(id);
    return despesa ? { tipo: 'safra', recursoId: despesa.safra_id } : null;
  })
);

router.put('/:id', despesasPessoaisController.atualizar);
router.delete('/:id', despesasPessoaisController.excluir);

export default router;
