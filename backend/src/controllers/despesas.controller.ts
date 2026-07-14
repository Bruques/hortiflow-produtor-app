import { Request, Response } from 'express';
import { z } from 'zod';
import { TipoDespesa } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as despesasService from '../services/despesas.service';

const criarSchema = z.object({
  socio_id: z.string().min(1),
  tipo: z.nativeEnum(TipoDespesa),
  valor: z.number().positive(),
  data: z.coerce.date(),
  foto_comprovante: z.string().optional(),
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
    res.status(400).json({ error: 'Dados de despesa inválidos' });
    return;
  }

  const socioValido = await despesasService.socioPertenceASociedade(
    parsed.data.socio_id,
    safra.sociedade_id
  );
  if (!socioValido) {
    res.status(422).json({ error: 'socio_id informado não pertence a essa sociedade' });
    return;
  }

  const despesa = await despesasService.criarDespesa(id, parsed.data);
  res.status(201).json({ despesa });
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

  const despesas = await despesasService.listarDespesas(id);
  res.json({ despesas });
}
