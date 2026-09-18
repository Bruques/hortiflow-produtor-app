import { Router } from 'express';
import * as acertosController from '../controllers/acertos.controller';
import * as acertosService from '../services/acertos.service';
import { authMiddleware } from '../middlewares/auth';
import { criarGateAssinaturaPorRecurso } from '../middlewares/assinaturaGate';

const router = Router();

router.use(authMiddleware);

// Spec 27 — criar/listar acerto já são gated (nested em /safras/:id/acertos); ver detalhe de
// um acerto ficava de fora por ser uma rota à parte, com :id = id do acerto.
router.use(
  '/:id',
  criarGateAssinaturaPorRecurso(async (id) => {
    const safraId = await acertosService.buscarSafraIdDoAcerto(id);
    return safraId ? { tipo: 'safra', recursoId: safraId } : null;
  })
);

router.get('/:id', acertosController.detalhar);

export default router;
