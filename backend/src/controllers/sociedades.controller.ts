import { Request, Response } from 'express';
import { z } from 'zod';
import { PapelSocio } from '@prisma/client';
import * as sociedadesService from '../services/sociedades.service';

const criarSociedadeSchema = z.object({
  nome: z.string().min(1),
});

const entrarSchema = z.object({
  codigo_convite: z.string().min(1),
  vincular_socio_id: z.string().min(1).optional(),
});

const percentuaisSchema = z.object({
  socios: z
    .array(
      z.object({
        id: z.string().min(1),
        percentual_lucro: z.number().min(0).max(100),
        papel: z.nativeEnum(PapelSocio),
      })
    )
    .min(1),
});

const novoSocioSchema = z.object({
  nome: z.string().min(1),
  papel: z.nativeEnum(PapelSocio),
});

export async function criar(req: Request, res: Response): Promise<void> {
  const parsed = criarSociedadeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nome da sociedade é obrigatório' });
    return;
  }

  const resultado = await sociedadesService.criarSociedade(req.usuarioId, parsed.data.nome);
  res.status(201).json(resultado);
}

export async function entrar(req: Request, res: Response): Promise<void> {
  const parsed = entrarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Código de convite é obrigatório' });
    return;
  }

  const resultado = await sociedadesService.entrarPorCodigo(
    req.usuarioId,
    parsed.data.codigo_convite,
    parsed.data.vincular_socio_id
  );

  if ('erro' in resultado) {
    if (resultado.erro === 'NAO_ENCONTRADA' || resultado.erro === 'SOCIO_NAO_ENCONTRADO') {
      res.status(404).json({ error: 'Código de convite ou sócio não encontrado' });
      return;
    }
    if (resultado.erro === 'JA_E_SOCIO') {
      res.status(409).json({ error: 'Você já é sócio dessa sociedade' });
      return;
    }
    res.status(409).json({ error: 'Esse sócio já está vinculado a uma conta' });
    return;
  }

  res.json(resultado);
}

export async function previewConvite(req: Request, res: Response): Promise<void> {
  const { codigo } = req.params;

  const resultado = await sociedadesService.previewConvite(codigo);

  if ('erro' in resultado) {
    res.status(404).json({ error: 'Código de convite não encontrado' });
    return;
  }

  res.json(resultado);
}

export async function criarSocio(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = novoSocioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nome e papel do sócio são obrigatórios' });
    return;
  }

  const socio = await sociedadesService.criarSocioSemConta(id, parsed.data.nome, parsed.data.papel);
  res.status(201).json({ socio });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const sociedades = await sociedadesService.listarSociedadesDoUsuario(req.usuarioId);
  res.json({ sociedades });
}

export async function listarSocios(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const socios = await sociedadesService.listarSocios(id);
  res.json({ socios });
}

export async function atualizarPercentuais(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = percentuaisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Lista de sócios com percentual_lucro e papel é obrigatória' });
    return;
  }

  const resultado = await sociedadesService.atualizarPercentuais(id, parsed.data.socios);

  if ('erro' in resultado) {
    if (resultado.erro === 'SOCIOS_FALTANDO') {
      res
        .status(422)
        .json({ error: 'A lista precisa cobrir todos os sócios atuais da sociedade' });
      return;
    }
    res.status(422).json({
      error: `A soma dos percentuais precisa ser 100%. Soma recebida: ${resultado.soma}%`,
    });
    return;
  }

  res.json(resultado);
}
