import { Router } from 'express';
import * as unidadesController from '../controllers/unidadesVenda.controller';
import * as unidadesService from '../services/unidadesVenda.service';
import { authMiddleware } from '../middlewares/auth';
import { criarGateAssinaturaPorRecurso } from '../middlewares/assinaturaGate';

const router = Router();

router.use(authMiddleware);

// Spec 27 — criar/listar unidade já são gated (nested em /sociedades/:id/unidades-venda);
// ativar/desativar ficava de fora por ser uma rota à parte, com :id = id da unidade.
router.use(
  '/:id',
  criarGateAssinaturaPorRecurso(async (id) => {
    const unidade = await unidadesService.buscarUnidadePorId(id);
    return unidade ? { tipo: 'sociedade', recursoId: unidade.sociedade_id } : null;
  })
);

router.patch('/:id', unidadesController.atualizarAtivo);

export default router;
