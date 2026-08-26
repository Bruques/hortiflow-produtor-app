import { Request, Response } from 'express';
import { z } from 'zod';
import * as assinaturaService from '../services/assinatura.service';

export async function listarAssinaturas(_req: Request, res: Response): Promise<void> {
  const titulares = await assinaturaService.listarParaAdmin();
  res.json(titulares);
}

export async function listarPlanos(_req: Request, res: Response): Promise<void> {
  const planos = await assinaturaService.listarPlanos();
  res.json(planos);
}

const atribuirPlanoSchema = z.object({ planoId: z.string().min(1) });

export async function atribuirPlano(req: Request, res: Response): Promise<void> {
  const parsed = atribuirPlanoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'planoId é obrigatório' });
    return;
  }

  const resultado = await assinaturaService.atribuirPlano(req.params.usuarioId, parsed.data.planoId);
  if ('erro' in resultado) {
    res.status(404).json({ error: resultado.erro === 'ASSINATURA_NAO_ENCONTRADA' ? 'Assinatura não encontrada' : 'Plano não encontrado' });
    return;
  }
  res.json({ plano: resultado.plano });
}

const limiteSafrasSchema = z.object({ limiteSafrasAtivasOverride: z.number().int().nonnegative().nullable() });

export async function definirLimiteSafras(req: Request, res: Response): Promise<void> {
  const parsed = limiteSafrasSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'limiteSafrasAtivasOverride precisa ser um número ou null' });
    return;
  }

  const resultado = await assinaturaService.definirLimiteOverride(req.params.usuarioId, parsed.data.limiteSafrasAtivasOverride);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json({ limiteEfetivo: resultado.limiteEfetivo });
}

const editarPlanoSchema = z.object({
  valorMensal: z.number().positive().optional(),
  limiteSafrasAtivas: z.number().int().nonnegative().nullable().optional(),
});

export async function editarPlano(req: Request, res: Response): Promise<void> {
  const parsed = editarPlanoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos' });
    return;
  }

  const resultado = await assinaturaService.editarPlano(req.params.planoId, parsed.data);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Plano não encontrado' });
    return;
  }
  res.json({ plano: resultado.plano });
}

export async function checkoutLink(req: Request, res: Response): Promise<void> {
  const callbackUrl = `${process.env.FRONTEND_URL}/assinatura`;
  const resultado = await assinaturaService.gerarCheckoutLink(req.params.usuarioId, callbackUrl);
  if ('erro' in resultado) {
    res.status(resultado.erro === 'PLANO_NAO_ATRIBUIDO' ? 409 : 404).json({
      error: resultado.erro === 'PLANO_NAO_ATRIBUIDO' ? 'Atribua um plano antes de gerar o checkout' : 'Assinatura não encontrada',
    });
    return;
  }
  res.json({ checkoutUrl: resultado.checkoutUrl });
}

const pagamentoManualSchema = z.object({
  valor: z.number().positive(),
  metodo: z.enum(['MANUAL_PIX', 'MANUAL_DINHEIRO']),
  dias: z.number().int().positive(),
});

export async function pagamentoManual(req: Request, res: Response): Promise<void> {
  const parsed = pagamentoManualSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'valor, metodo e dias são obrigatórios' });
    return;
  }

  const resultado = await assinaturaService.registrarPagamentoManual(req.params.usuarioId, parsed.data, req.adminId);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json({ dataFimAcesso: resultado.dataFimAcesso });
}
