import { Request, Response } from 'express';
import { z } from 'zod';
import * as regrasService from '../services/regrasDespesaRecorrente.service';
import * as unidadesService from '../services/unidadesVenda.service';

const criarSchema = z.object({
  nome: z.string().trim().min(1),
});

export async function criar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const podeConfigurar = await regrasService.podeConfigurarRegra(req.usuarioId, id);
  if (!podeConfigurar) {
    res.status(403).json({ error: 'Só sócios financiadores podem configurar unidades de venda' });
    return;
  }

  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de unidade inválidos' });
    return;
  }

  const resultado = await unidadesService.criarUnidade(id, parsed.data.nome);
  if ('erro' in resultado) {
    res.status(409).json({ error: 'Já existe uma unidade com esse nome nessa sociedade' });
    return;
  }

  res.status(201).json({ unidade: resultado.unidade });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const ehSocio = await regrasService.socioPertenceASociedade(req.usuarioId, id);
  if (!ehSocio) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const unidades = await unidadesService.listarUnidades(id);
  res.json({ unidades });
}

const atualizarSchema = z.object({
  ativo: z.boolean(),
});

export async function atualizarAtivo(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // unidade id

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos' });
    return;
  }

  const unidadeAtual = await unidadesService.buscarUnidadePorId(id);
  if (!unidadeAtual) {
    res.status(404).json({ error: 'Unidade não encontrada' });
    return;
  }

  const podeConfigurar = await regrasService.podeConfigurarRegra(req.usuarioId, unidadeAtual.sociedade_id);
  if (!podeConfigurar) {
    res.status(403).json({ error: 'Só sócios financiadores podem configurar unidades de venda' });
    return;
  }

  const resultado = await unidadesService.atualizarAtivo(id, parsed.data.ativo);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Unidade não encontrada' });
    return;
  }

  res.json({ unidade: resultado.unidade });
}
