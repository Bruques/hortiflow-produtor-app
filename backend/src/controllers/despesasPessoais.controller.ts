import { Request, Response } from 'express';
import { z } from 'zod';
import { TipoDespesa } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as despesasPessoaisService from '../services/despesasPessoais.service';

const criarSchema = z.object({
  tipo: z.nativeEnum(TipoDespesa),
  valor: z.number().positive(),
  data: z.coerce.date(),
  descricao: z.string().optional(),
});

const atualizarSchema = criarSchema.partial();

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
    res.status(400).json({ error: 'Dados de despesa pessoal inválidos' });
    return;
  }

  const despesaPessoal = await despesasPessoaisService.criarDespesaPessoal(
    id,
    req.usuarioId,
    parsed.data
  );
  res.status(201).json({ despesaPessoal });
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

  const despesasPessoais = await despesasPessoaisService.listarDespesasPessoais(id, req.usuarioId);
  res.json({ despesasPessoais });
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // despesa pessoal id

  const despesa = await despesasPessoaisService.buscarDespesaPessoal(id);
  if (!despesa) {
    res.status(404).json({ error: 'Despesa pessoal não encontrada' });
    return;
  }
  if (despesa.usuario_id !== req.usuarioId) {
    res.status(403).json({ error: 'Você não pode editar essa despesa' });
    return;
  }

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de despesa pessoal inválidos' });
    return;
  }

  const atualizada = await despesasPessoaisService.atualizarDespesaPessoal(id, parsed.data);
  res.json({ despesaPessoal: atualizada });
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // despesa pessoal id

  const despesa = await despesasPessoaisService.buscarDespesaPessoal(id);
  if (!despesa) {
    res.status(404).json({ error: 'Despesa pessoal não encontrada' });
    return;
  }
  if (despesa.usuario_id !== req.usuarioId) {
    res.status(403).json({ error: 'Você não pode excluir essa despesa' });
    return;
  }

  await despesasPessoaisService.excluirDespesaPessoal(id);
  res.status(204).send();
}
