import { Request, Response } from 'express';
import { z } from 'zod';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';

const abrirSchema = z.object({
  nome: z.string().min(1),
});

export async function listarMinhas(req: Request, res: Response): Promise<void> {
  const safras = await safrasService.listarSafrasDoUsuario(req.usuarioId);
  res.json({ safras });
}

export async function abrir(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = abrirSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nome da safra é obrigatório' });
    return;
  }

  const safra = await safrasService.abrirSafra(id, parsed.data.nome);
  res.status(201).json({ safra });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const safras = await safrasService.listarSafras(id);
  res.json({ safras });
}

export async function obter(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  res.json({ safra });
}

export async function encerrar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const resultado = await safrasService.encerrarSafra(id);
  if ('erro' in resultado) {
    if (resultado.erro === 'NAO_ENCONTRADA') {
      res.status(404).json({ error: 'Safra não encontrada' });
      return;
    }
    res.status(409).json({ error: 'Safra já está encerrada' });
    return;
  }

  res.json({ safra: resultado.safra });
}
