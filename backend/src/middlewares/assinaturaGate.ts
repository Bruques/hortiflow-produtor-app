import { Request, Response, NextFunction } from 'express';
import * as assinaturaService from '../services/assinatura.service';

// Spec 18 — gate de tempo (402). Aplicado via router.use() depois do authMiddleware nos
// routers escopados a uma Sociedade (sociedades.ts, com `:id` = sociedadeId) ou a uma Safra
// (safras.ts, com `:id` = safraId). Rotas sem `:id` (ex.: POST /sociedades, GET /safras) não
// têm o que checar aqui e passam direto — a criação de uma nova Sociedade é checada à parte,
// dentro do próprio controller, usando a assinatura do usuário autenticado.
export function criarGateAssinatura(tipo: 'sociedade' | 'safra') {
  return async function gateAssinatura(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = req.params.id;
    if (!id) {
      next();
      return;
    }

    const liberado =
      tipo === 'sociedade'
        ? await assinaturaService.acessoLiberadoParaSociedade(id)
        : await assinaturaService.acessoLiberadoParaSafra(id);

    if (!liberado) {
      res.status(402).json({ error: assinaturaService.mensagemAssinaturaVencida() });
      return;
    }

    next();
  };
}
