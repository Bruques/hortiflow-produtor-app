import { Router } from 'express';
import * as regrasController from '../controllers/regrasDespesaRecorrente.controller';
import * as regrasService from '../services/regrasDespesaRecorrente.service';
import { authMiddleware } from '../middlewares/auth';
import { criarGateAssinaturaPorRecurso } from '../middlewares/assinaturaGate';

const router = Router();

router.use(authMiddleware);

// Spec 27 — criar/listar regra já são gated (nested em /sociedades/:id/regras-recorrentes);
// ativar/editar ficavam de fora por serem uma rota à parte, com :id = id da regra.
router.use(
  '/:id',
  criarGateAssinaturaPorRecurso(async (id) => {
    const regra = await regrasService.buscarRegraPorId(id);
    return regra ? { tipo: 'sociedade', recursoId: regra.sociedade_id } : null;
  })
);

router.patch('/:id', regrasController.atualizarAtivo);
router.put('/:id', regrasController.atualizar);
router.delete('/:id', regrasController.excluir);

export default router;
