import { Request, Response } from 'express';
import { z } from 'zod';
import * as safrasService from '../services/safras.service';
import * as vendasService from '../services/vendas.service';
import * as acertosService from '../services/acertos.service';
import * as unidadesService from '../services/unidadesVenda.service';
import * as regrasService from '../services/regrasDespesaRecorrente.service';
import { resolverPeriodo, filtroDataPrisma } from '../lib/periodo';

const criarSchema = z.object({
  data: z.coerce.date(),
  quantidade: z.number().positive(),
  preco: z.number().positive(),
  comprador: z.string().optional(),
  unidade_id: z.string().min(1),
  pago: z.boolean().optional(),
  regras_por_venda_aplicadas: z.array(z.string().min(1)).optional(),
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

  const regrasValidas = await regrasService.todasRegrasPorVendaValidas(
    safra.sociedade_id,
    parsed.data.unidade_id,
    parsed.data.regras_por_venda_aplicadas ?? []
  );
  if (!regrasValidas) {
    res.status(422).json({ error: 'regras_por_venda_aplicadas contém regra inválida para essa venda' });
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

  const { pago } = req.query;
  const pagoFiltro = pago === 'true' ? true : pago === 'false' ? false : undefined;

  // Sem periodo/data_inicio/data_fim na query, assume "hoje" — evita que o primeiro
  // carregamento da tela busque a safra inteira quando o cliente ainda não escolheu período.
  const query = { ...req.query };
  if (!query.periodo && !query.data_inicio && !query.data_fim) {
    query.periodo = 'dia';
  }

  const intervalo = resolverPeriodo(query);
  if (intervalo === null) {
    res.status(400).json({ error: 'periodo inválido (use dia, semana, mes, safra ou data_inicio/data_fim)' });
    return;
  }

  const vendas = await vendasService.listarVendas(id, pagoFiltro, filtroDataPrisma(intervalo));
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

  if (parsed.data.regras_por_venda_aplicadas !== undefined) {
    const unidadeParaValidar = parsed.data.unidade_id ?? venda.unidade_id;
    const regrasValidas = await regrasService.todasRegrasPorVendaValidas(
      safra.sociedade_id,
      unidadeParaValidar,
      parsed.data.regras_por_venda_aplicadas
    );
    if (!regrasValidas) {
      res.status(422).json({ error: 'regras_por_venda_aplicadas contém regra inválida para essa venda' });
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
