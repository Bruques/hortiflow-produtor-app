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

// Spec 27 — mesmo gate, mas para rotas cujo `:id` é o id do próprio recurso (despesa, despesa
// pessoal, regra recorrente, unidade de venda, acerto), não o id da Sociedade/Safra dona dele.
// O `resolver` busca o recurso e devolve a qual Sociedade/Safra ele pertence; se o recurso não
// existe, passa direto (404 é responsabilidade do controller, igual ao padrão de
// acessoLiberadoParaSociedade/Safra acima).
type RecursoResolvido = { tipo: 'sociedade' | 'safra'; recursoId: string } | null;

export function criarGateAssinaturaPorRecurso(resolver: (id: string) => Promise<RecursoResolvido>) {
  return async function gateAssinaturaPorRecurso(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = req.params.id;
    if (!id) {
      next();
      return;
    }

    const alvo = await resolver(id);
    if (!alvo) {
      next();
      return;
    }

    const liberado =
      alvo.tipo === 'sociedade'
        ? await assinaturaService.acessoLiberadoParaSociedade(alvo.recursoId)
        : await assinaturaService.acessoLiberadoParaSafra(alvo.recursoId);

    if (!liberado) {
      res.status(402).json({ error: assinaturaService.mensagemAssinaturaVencida() });
      return;
    }

    next();
  };
}
