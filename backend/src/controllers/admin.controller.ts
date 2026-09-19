import { Request, Response } from 'express';
import { z } from 'zod';
import * as assinaturaService from '../services/assinatura.service';
import * as dashboardService from '../services/adminDashboard.service';

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

// Spec 28 — cortesia é o "liberar sem pagar": só ela pode ter valor 0, e ela nunca tem valor.
const pagamentoManualSchema = z
  .object({
    valor: z.number().nonnegative(),
    metodo: z.enum(['MANUAL_PIX', 'MANUAL_DINHEIRO', 'MANUAL_CORTESIA']),
    dias: z.number().int().positive(),
  })
  .refine((d) => (d.metodo === 'MANUAL_CORTESIA' ? d.valor === 0 : d.valor > 0), {
    message: 'Cortesia exige valor 0; Pix e dinheiro exigem valor maior que 0',
  });

export async function pagamentoManual(req: Request, res: Response): Promise<void> {
  const parsed = pagamentoManualSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'valor, metodo e dias são obrigatórios' });
    return;
  }

  const resultado = await assinaturaService.registrarPagamentoManual(req.params.usuarioId, parsed.data, req.adminId);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json({ dataFimAcesso: resultado.dataFimAcesso });
}

// --- Spec 28: painel do dono ---

export async function dashboard(_req: Request, res: Response): Promise<void> {
  res.json(await dashboardService.carregarDashboard());
}

const cobrancaSchema = z.object({
  planoId: z.string().min(1),
  ciclo: z.enum(['MENSAL', 'ANUAL']),
  metodo: z.enum(['PIX', 'CARTAO']),
  desconto: z.object({ tipo: z.enum(['PERCENTUAL', 'VALOR']), valor: z.number() }).optional(),
});

export async function gerarCobranca(req: Request, res: Response): Promise<void> {
  const parsed = cobrancaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'planoId, ciclo e metodo são obrigatórios' });
    return;
  }

  const urls = {
    callbackUrl: `${process.env.FRONTEND_URL}/assinatura`,
    notificationUrl: `${process.env.BACKEND_PUBLIC_URL}/api/webhooks/mercadopago?token=${process.env.MP_WEBHOOK_TOKEN}`,
  };
  const resultado = await assinaturaService.gerarCobrancaAdmin(req.params.usuarioId, parsed.data, urls);

  if ('erro' in resultado) {
    const mensagens = {
      ASSINATURA_NAO_ENCONTRADA: [404, 'Assinatura não encontrada'],
      PLANO_NAO_ENCONTRADO: [404, 'Plano não encontrado'],
      DESCONTO_INVALIDO: [400, 'Desconto inválido: use uma porcentagem entre 0 e 100 ou um valor menor que o preço do plano'],
      VALOR_FINAL_ABAIXO_DO_MINIMO: [400, 'O valor final não pode ser menor que R$ 1,00'],
    } as const;
    const [status, error] = mensagens[resultado.erro];
    res.status(status).json({ error });
    return;
  }
  res.json(resultado);
}

export async function verificarPix(req: Request, res: Response): Promise<void> {
  const resultado = await assinaturaService.verificarPixAdmin(req.params.usuarioId, req.params.orderId);
  if ('erro' in resultado) {
    res.status(resultado.erro === 'ASSINATURA_NAO_ENCONTRADA' ? 404 : 409).json({
      error: resultado.erro === 'ASSINATURA_NAO_ENCONTRADA' ? 'Assinatura não encontrada' : 'Esse Pix não pertence a esse produtor',
    });
    return;
  }
  res.json(resultado);
}

export async function cancelarAssinatura(req: Request, res: Response): Promise<void> {
  const resultado = await assinaturaService.cancelarAssinaturaAdmin(req.params.usuarioId);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json(resultado);
}

const bloqueioSchema = z.object({ bloqueado: z.boolean() });

export async function definirBloqueio(req: Request, res: Response): Promise<void> {
  const parsed = bloqueioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'bloqueado precisa ser true ou false' });
    return;
  }

  const resultado = await assinaturaService.definirBloqueioUsuario(req.params.usuarioId, parsed.data.bloqueado, req.adminId);
  if ('erro' in resultado) {
    res.status(resultado.erro === 'USUARIO_NAO_ENCONTRADO' ? 404 : 409).json({
      error: resultado.erro === 'USUARIO_NAO_ENCONTRADO' ? 'Usuário não encontrado' : 'Conta excluída não pode ser bloqueada ou desbloqueada',
    });
    return;
  }
  res.json(resultado);
}
