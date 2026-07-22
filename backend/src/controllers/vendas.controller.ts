import { Request, Response } from 'express';
import { z } from 'zod';
import * as safrasService from '../services/safras.service';
import * as vendasService from '../services/vendas.service';
import * as acertosService from '../services/acertos.service';
import * as unidadesService from '../services/unidadesVenda.service';

const criarSchema = z.object({
  data: z.coerce.date(),
  quantidade: z.number().positive(),
  preco: z.number().positive(),
  comprador: z.string().optional(),
  unidade_id: z.string().min(1),
  pago: z.boolean().optional(),
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
    res.status(400).json({ error: 'Dados de venda inválidos' });
    return;
  }

  const unidadeValida = await unidadesService.unidadePertenceASociedade(parsed.data.unidade_id, safra.sociedade_id);
  if (!unidadeValida) {
    res.status(422).json({ error: 'unidade_id informado não pertence a essa sociedade' });
    return;
  }

  const venda = await vendasService.criarVenda(id, safra.sociedade_id, parsed.data);
  res.status(201).json({ venda });
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

  const vendas = await vendasService.listarVendas(id);
  res.json({ vendas });
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const { vendaId } = req.params;

  const venda = await vendasService.buscarVenda(vendaId);
  if (!venda) {
    res.status(404).json({ error: 'Venda não encontrada' });
    return;
  }

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, venda.safra_id);
  if (!safra || !autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const cobertaPorAcerto = await acertosService.dataCobertaPorAcerto(venda.safra_id, venda.data);
  if (cobertaPorAcerto) {
    res.status(409).json({ error: 'Essa venda já faz parte de um acerto registrado e não pode ser editada' });
    return;
  }

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de venda inválidos' });
    return;
  }

  if (parsed.data.unidade_id) {
    const unidadeValida = await unidadesService.unidadePertenceASociedade(parsed.data.unidade_id, safra.sociedade_id);
    if (!unidadeValida) {
      res.status(422).json({ error: 'unidade_id informado não pertence a essa sociedade' });
      return;
    }
  }

  const atualizada = await vendasService.atualizarVenda(vendaId, safra.sociedade_id, parsed.data);
  res.json({ venda: atualizada });
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const { vendaId } = req.params;

  const venda = await vendasService.buscarVenda(vendaId);
  if (!venda) {
    res.status(404).json({ error: 'Venda não encontrada' });
    return;
  }

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, venda.safra_id);
  if (!safra || !autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const cobertaPorAcerto = await acertosService.dataCobertaPorAcerto(venda.safra_id, venda.data);
  if (cobertaPorAcerto) {
    res.status(409).json({ error: 'Essa venda já faz parte de um acerto registrado e não pode ser excluída' });
    return;
  }

  await vendasService.excluirVenda(vendaId);
  res.status(204).send();
}
