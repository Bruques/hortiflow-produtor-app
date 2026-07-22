import { Request, Response } from 'express';
import { z } from 'zod';
import { TipoDespesa } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as despesasService from '../services/despesas.service';
import * as acertosService from '../services/acertos.service';
import { resolverPeriodo, filtroDataPrisma } from '../lib/periodo';

const criarSchema = z.object({
  socio_id: z.string().min(1),
  tipo: z.nativeEnum(TipoDespesa),
  valor: z.number().positive(),
  data: z.coerce.date(),
  foto_comprovante: z.string().optional(),
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

  const despesas = await despesasService.listarDespesas(id, filtroDataPrisma(intervalo));
  res.json({ despesas });
}

export async function atualizar(req: Request, res: Response): Promise<void> {
  const { despesaId } = req.params;

  const despesa = await despesasService.buscarDespesa(despesaId);
  if (!despesa) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return;
  }

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, despesa.safra_id);
  if (!safra || !autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const cobertaPorAcerto = await acertosService.dataCobertaPorAcerto(despesa.safra_id, despesa.data);
  if (cobertaPorAcerto) {
    res.status(409).json({ error: 'Essa despesa já faz parte de um acerto registrado e não pode ser editada' });
    return;
  }

  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de despesa inválidos' });
    return;
  }

  if (parsed.data.socio_id) {
    const socioValido = await despesasService.socioPertenceASociedade(parsed.data.socio_id, safra.sociedade_id);
    if (!socioValido) {
      res.status(422).json({ error: 'socio_id informado não pertence a essa sociedade' });
      return;
    }
  }

  const atualizada = await despesasService.atualizarDespesa(despesaId, parsed.data);
  res.json({ despesa: atualizada });
}

export async function excluir(req: Request, res: Response): Promise<void> {
  const { despesaId } = req.params;

  const despesa = await despesasService.buscarDespesa(despesaId);
  if (!despesa) {
    res.status(404).json({ error: 'Despesa não encontrada' });
    return;
  }

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, despesa.safra_id);
  if (!safra || !autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const cobertaPorAcerto = await acertosService.dataCobertaPorAcerto(despesa.safra_id, despesa.data);
  if (cobertaPorAcerto) {
    res.status(409).json({ error: 'Essa despesa já faz parte de um acerto registrado e não pode ser excluída' });
    return;
  }

  await despesasService.excluirDespesa(despesaId);
  res.status(204).send();
}
