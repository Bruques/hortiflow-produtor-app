import { Request, Response } from 'express';
import { z } from 'zod';
import { TipoDespesa, TipoGatilhoRegra } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as regrasService from '../services/regrasDespesaRecorrente.service';
import * as unidadesService from '../services/unidadesVenda.service';

const criarSchema = z.object({
  tipo_gatilho: z.nativeEnum(TipoGatilhoRegra),
  tipo_despesa: z.nativeEnum(TipoDespesa),
  valor: z.number().positive(),
  unidade_id: z.string().min(1).optional(),
  rateio: z.array(z.object({ socio_id: z.string().min(1), percentual: z.number().positive() })).optional(),
});

export async function criar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const podeConfigurar = await regrasService.podeConfigurarRegra(req.usuarioId, id);
  if (!podeConfigurar) {
    res.status(403).json({ error: 'Só sócios financiadores podem configurar despesa recorrente' });
    return;
  }

  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de regra inválidos' });
    return;
  }

  if (parsed.data.tipo_gatilho === TipoGatilhoRegra.POR_VENDA) {
    if (!parsed.data.unidade_id) {
      res.status(422).json({ error: 'unidade_id é obrigatório para regras do tipo POR_VENDA' });
      return;
    }
    const unidadeValida = await unidadesService.unidadePertenceASociedade(parsed.data.unidade_id, id);
    if (!unidadeValida) {
      res.status(422).json({ error: 'unidade_id informado não pertence a essa sociedade' });
      return;
    }
  }

  if (parsed.data.rateio) {
    const rateioValido = await regrasService.rateioValido(id, parsed.data.rateio);
    if (!rateioValido) {
      res.status(422).json({ error: 'rateio precisa somar 100% entre sócios da mesma sociedade' });
      return;
    }
  }

  const regra = await regrasService.criarRegra(id, req.usuarioId, parsed.data);
  res.status(201).json({ regra });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const ehSocio = await regrasService.socioPertenceASociedade(req.usuarioId, id);
  if (!ehSocio) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const regras = await regrasService.listarRegras(id);
  res.json({ regras });
}

const atualizarSchema = z.object({
  ativo: z.boolean(),
});

export async function atualizarAtivo(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // regra id

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados inválidos' });
    return;
  }

  const regraAtual = await regrasService.buscarRegraPorId(id);
  if (!regraAtual) {
    res.status(404).json({ error: 'Regra não encontrada' });
    return;
  }

  const podeConfigurar = await regrasService.podeConfigurarRegra(req.usuarioId, regraAtual.sociedade_id);
  if (!podeConfigurar) {
    res.status(403).json({ error: 'Só sócios financiadores podem configurar despesa recorrente' });
    return;
  }

  const resultado = await regrasService.atualizarAtivo(id, parsed.data.ativo);
  if ('erro' in resultado) {
    res.status(404).json({ error: 'Regra não encontrada' });
    return;
  }

  res.json({ regra: resultado.regra });
}

const putSchema = z.object({
  tipo_despesa: z.nativeEnum(TipoDespesa),
  valor: z.number().positive(),
  unidade_id: z.string().min(1).optional(),
  rateio: z.array(z.object({ socio_id: z.string().min(1), percentual: z.number().positive() })).optional(),
});

export async function atualizar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // regra id

  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de regra inválidos' });
    return;
  }

  const regraAtual = await regrasService.buscarRegraPorId(id);
  if (!regraAtual) {
    res.status(404).json({ error: 'Regra não encontrada' });
    return;
  }

  const podeConfigurar = await regrasService.podeConfigurarRegra(req.usuarioId, regraAtual.sociedade_id);
  if (!podeConfigurar) {
    res.status(403).json({ error: 'Só sócios financiadores podem configurar despesa recorrente' });
    return;
  }

  // tipo_gatilho não é editável — unidade_id só se aplica/persiste se a regra já for POR_VENDA
  if (regraAtual.tipo_gatilho === TipoGatilhoRegra.POR_VENDA) {
    if (!parsed.data.unidade_id) {
      res.status(422).json({ error: 'unidade_id é obrigatório para regras do tipo POR_VENDA' });
      return;
    }
    const unidadeValida = await unidadesService.unidadePertenceASociedade(parsed.data.unidade_id, regraAtual.sociedade_id);
    if (!unidadeValida) {
      res.status(422).json({ error: 'unidade_id informado não pertence a essa sociedade' });
      return;
    }
  }

  if (parsed.data.rateio) {
    const rateioValido = await regrasService.rateioValido(regraAtual.sociedade_id, parsed.data.rateio);
    if (!rateioValido) {
      res.status(422).json({ error: 'rateio precisa somar 100% entre sócios da mesma sociedade' });
      return;
    }
  }

  const regra = await regrasService.atualizarRegra(id, {
    tipo_despesa: parsed.data.tipo_despesa,
    valor: parsed.data.valor,
    unidade_id: regraAtual.tipo_gatilho === TipoGatilhoRegra.POR_VENDA ? parsed.data.unidade_id : undefined,
    rateio: parsed.data.rateio,
  });
  res.json({ regra });
}

export async function sugestoes(req: Request, res: Response): Promise<void> {
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

  const sugestoes = await regrasService.listarSugestoesDoDia(id, safra.sociedade_id);
  res.json({ sugestoes });
}

export async function confirmar(req: Request, res: Response): Promise<void> {
  const { id, regraId } = req.params; // safra id, regra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const resultado = await regrasService.confirmarSugestao(id, regraId);
  if ('erro' in resultado) {
    if (resultado.erro === 'JA_CONFIRMADA') {
      res.status(409).json({ error: 'Essa regra já foi confirmada hoje' });
      return;
    }
    res.status(404).json({ error: 'Regra não encontrada' });
    return;
  }

  res.status(201).json({ despesa: resultado.despesa });
}
