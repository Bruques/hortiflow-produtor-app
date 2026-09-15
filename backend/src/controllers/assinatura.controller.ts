import { Request, Response } from 'express';
import { z } from 'zod';
import * as assinaturaService from '../services/assinatura.service';

export async function status(req: Request, res: Response): Promise<void> {
  const status = await assinaturaService.statusDoUsuario(req.usuarioId);
  if (!status) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json(status);
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const resultado = await assinaturaService.cancelarAssinaturaDoUsuario(req.usuarioId);
  if ('erro' in resultado) {
    res.status(400).json({ error: 'Nenhuma assinatura ativa pra cancelar' });
    return;
  }
  res.json({ dataFimAcesso: resultado.dataFimAcesso });
}

// --- Spec 25: onboarding automatizado e checkout Mercado Pago ---

export async function listarPlanos(_req: Request, res: Response): Promise<void> {
  res.json(await assinaturaService.listarPlanosPublico());
}

const onboardingSchema = z
  .object({
    faixaMeeiros: z.enum(['UM_A_TRES', 'QUATRO_A_DEZ', 'DEZ_OU_MAIS']),
    quantidadePes: z.number().int().nonnegative(),
    localizacaoProducao: z.enum(['BOM_REPOUSO', 'OUTRA_CIDADE']),
    // Obrigatório só quando localizacaoProducao é OUTRA_CIDADE (checado no .refine abaixo).
    localizacaoProducaoOutra: z.string().trim().min(1).optional(),
  })
  .refine((dados) => dados.localizacaoProducao !== 'OUTRA_CIDADE' || !!dados.localizacaoProducaoOutra, {
    message: 'Informe o nome da cidade',
    path: ['localizacaoProducaoOutra'],
  });

export async function onboarding(req: Request, res: Response): Promise<void> {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados do formulário inválidos' });
    return;
  }

  const resultado = await assinaturaService.responderOnboarding(req.usuarioId, parsed.data);
  if ('erro' in resultado) {
    const status = resultado.erro === 'ONBOARDING_JA_RESPONDIDO' ? 400 : 404;
    const mensagem =
      resultado.erro === 'ONBOARDING_JA_RESPONDIDO'
        ? 'Formulário de onboarding já respondido'
        : resultado.erro === 'PLANO_NAO_ENCONTRADO'
          ? 'Plano recomendado não encontrado — seed de planos ausente'
          : 'Assinatura não encontrada';
    res.status(status).json({ error: mensagem });
    return;
  }

  res.json(resultado);
}

const escolherPlanoSchema = z.object({
  planoId: z.string().uuid(),
  ciclo: z.enum(['MENSAL', 'ANUAL']),
});

export async function escolherPlano(req: Request, res: Response): Promise<void> {
  const parsed = escolherPlanoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Plano ou ciclo inválido' });
    return;
  }

  const resultado = await assinaturaService.escolherPlano(req.usuarioId, parsed.data.planoId, parsed.data.ciclo);
  if ('erro' in resultado) {
    res.status(404).json({ error: resultado.erro === 'PLANO_NAO_ENCONTRADO' ? 'Plano não encontrado' : 'Assinatura não encontrada' });
    return;
  }

  res.json(resultado);
}

const checkoutSchema = z.object({
  planoId: z.string().uuid(),
  ciclo: z.enum(['MENSAL', 'ANUAL']),
  metodo: z.enum(['CARTAO', 'PIX']),
  // API agnóstica de cliente (ver CLAUDE.md): quem sabe pra onde deve voltar depois do
  // checkout hospedado é o cliente (app mobile com seu deep link, web com sua própria
  // origem) — o backend não deve fixar isso. Cai pro deep link do app mobile só por
  // compatibilidade com uma chamada antiga sem esse campo.
  retornoUrl: z.string().url().optional(),
  // Opcional — testado em 2026-09-15 sem CPF nenhum e o Mercado Pago aceitou o Pix
  // normalmente, apesar da documentação sugerir que seria obrigatório.
  cpf: z.string().trim().min(11).optional(),
});

export async function checkout(req: Request, res: Response): Promise<void> {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Plano ou ciclo inválido' });
    return;
  }

  const callbackUrl = parsed.data.retornoUrl ?? `${process.env.MOBILE_APP_SCHEME || 'hortiflowprodutor'}://checkout-retorno`;
  const notificationUrl = `${process.env.BACKEND_PUBLIC_URL}/api/webhooks/mercadopago?token=${process.env.MP_WEBHOOK_TOKEN}`;

  const resultado = await assinaturaService.iniciarCheckout(req.usuarioId, parsed.data, { callbackUrl, notificationUrl });
  if ('erro' in resultado) {
    res.status(404).json({ error: resultado.erro === 'PLANO_NAO_ENCONTRADO' ? 'Plano não encontrado' : 'Assinatura não encontrada' });
    return;
  }

  res.json(resultado);
}

export async function verificarPagamentoPix(req: Request, res: Response): Promise<void> {
  const { paymentId } = req.params;
  const resultado = await assinaturaService.verificarPagamentoPix(req.usuarioId, paymentId);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json(resultado);
}
