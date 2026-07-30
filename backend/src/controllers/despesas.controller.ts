import { Request, Response } from 'express';
import { z } from 'zod';
import { TipoDespesa, StatusSafra } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as despesasService from '../services/despesas.service';
import * as acertosService from '../services/acertos.service';
import { resolverPeriodo, filtroDataPrisma } from '../lib/periodo';

const rateioSchema = z.array(z.object({ socio_id: z.string().min(1), percentual: z.number().positive() }));

const criarSchema = z.object({
  socio_id: z.string().min(1),
  tipo: z.nativeEnum(TipoDespesa),
  valor: z.number().positive(),
  data: z.coerce.date(),
  foto_comprovante: z.string().optional(),
  descricao: z.string().optional(),
  rateio: rateioSchema.optional(),
});

const atualizarSchema = criarSchema.partial().extend({
  // null explícito remove o rateio customizado (volta ao padrão); omitido não mexe no rateio atual.
  rateio: rateioSchema.nullable().optional(),
});

const compartilhadaSchema = z.object({
  safra_ids: z.array(z.string().min(1)).min(2, 'Informe pelo menos 2 safras'),
  tipo: z.nativeEnum(TipoDespesa),
  valor_total: z.number().positive(),
  data: z.coerce.date(),
  descricao: z.string().optional(),
  foto_comprovante: z.string().optional(),
  rateio: z.discriminatedUnion('modo', [
    z.object({ modo: z.literal('igual') }),
    z.object({
      modo: z.literal('percentual'),
      percentuais: z
        .array(z.object({ safra_id: z.string().min(1), percentual: z.number().positive() }))
        .min(1),
    }),
  ]),
});

// "Tudo ou nada": valida TODAS as safras (dono + EM_ANDAMENTO) e o rateio antes de criar
// qualquer despesa; a criação em si roda em transação (despesasService.criarDespesaCompartilhada)
// pra nenhuma safra ficar com despesa órfã se outra falhar no meio (docs/specs/11).
export async function criarCompartilhada(req: Request, res: Response): Promise<void> {
  const parsed = compartilhadaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados de despesa compartilhada inválidos' });
    return;
  }
  const { safra_ids, tipo, valor_total, data, descricao, foto_comprovante, rateio } = parsed.data;

  if (new Set(safra_ids).size !== safra_ids.length) {
    res.status(422).json({ error: 'safra_ids não pode repetir a mesma safra' });
    return;
  }

  if (rateio.modo === 'percentual') {
    const idsRateio = new Set(rateio.percentuais.map((p) => p.safra_id));
    const idsInformados = new Set(safra_ids);
    const mesmoConjunto =
      idsRateio.size === idsInformados.size && [...idsRateio].every((id) => idsInformados.has(id));
    if (!mesmoConjunto) {
      res.status(422).json({ error: 'rateio.percentuais precisa cobrir exatamente as safras de safra_ids' });
      return;
    }
    const soma = rateio.percentuais.reduce((acc, p) => acc + p.percentual, 0);
    if (Math.abs(soma - 100) > 0.01) {
      res.status(422).json({ error: 'A soma dos percentuais precisa fechar em 100%' });
      return;
    }
  }

  const checagens = await Promise.all(
    safra_ids.map((id) => safrasService.ehSocioDaSafra(req.usuarioId, id))
  );
  const todasValidas = checagens.every(
    ({ safra, autorizado }) => safra && autorizado && safra.status === StatusSafra.EM_ANDAMENTO
  );
  if (!todasValidas) {
    res.status(422).json({
      error: 'Todas as safras precisam ser suas e estar em andamento',
    });
    return;
  }

  const despesas = await despesasService.criarDespesaCompartilhada(req.usuarioId, safra_ids, {
    tipo,
    valorTotal: valor_total,
    data,
    descricao,
    foto_comprovante,
    rateio,
  });

  res.status(201).json({ despesas });
}

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

  if (parsed.data.rateio) {
    const rateioValido = await despesasService.rateioValido(safra.sociedade_id, parsed.data.rateio);
    if (!rateioValido) {
      res.status(422).json({ error: 'rateio precisa somar 100% entre sócios da mesma sociedade' });
      return;
    }
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

  if (parsed.data.rateio) {
    const rateioValido = await despesasService.rateioValido(safra.sociedade_id, parsed.data.rateio);
    if (!rateioValido) {
      res.status(422).json({ error: 'rateio precisa somar 100% entre sócios da mesma sociedade' });
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
