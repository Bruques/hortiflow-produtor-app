import { Request, Response } from 'express';
import { z } from 'zod';
import { TipoAcerto } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';
import * as acertosService from '../services/acertos.service';

const criarSchema = z.object({
  data_inicio: z.coerce.date(),
  data_fim: z.coerce.date(),
  tipo: z.nativeEnum(TipoAcerto),
});

export async function criar(req: Request, res: Response): Promise<void> {
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

  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de acerto inválidos' });
    return;
  }

  const resultado = await acertosService.criarAcerto(
    id,
    parsed.data.data_inicio,
    parsed.data.data_fim,
    parsed.data.tipo
  );

  if ('erro' in resultado) {
    switch (resultado.erro) {
      case 'SAFRA_NAO_ENCONTRADA':
        res.status(404).json({ error: 'Safra não encontrada' });
        return;
      case 'SAFRA_NAO_EM_ANDAMENTO':
        res.status(400).json({ error: 'Safra precisa estar em andamento para registrar um acerto' });
        return;
      case 'PERIODO_INVALIDO':
        res.status(400).json({ error: 'data_inicio não pode ser depois de data_fim' });
        return;
      case 'PERIODO_SOBREPOSTO':
        res.status(400).json({ error: 'Período sobrepõe o último acerto já registrado dessa safra' });
        return;
    }
  }

  res.status(201).json(resultado.acerto);
}

export async function listar(req: Request, res: Response): Promise<void> {
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

  const acertos = await acertosService.listarAcertos(id);
  res.json(acertos);
}

export async function detalhar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // acerto id

  const resultado = await acertosService.buscarAcertoDetalhado(id);
  if (!resultado) {
    res.status(404).json({ error: 'Acerto não encontrado' });
    return;
  }

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, resultado.sociedadeId);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  res.json(resultado.acerto);
}
