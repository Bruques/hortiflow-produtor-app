import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';
import { calcularDivisao } from '../services/divisao.service';

// Todas as funções abaixo operam em UTC, não na hora local do servidor. Datas de
// Despesa/Venda chegam como "YYYY-MM-DD" e o Zod as interpreta como meia-noite UTC
// (z.coerce.date()) — usar hora local aqui criaria um desalinhamento de fuso (ex:
// servidor em UTC-3 trataria meia-noite UTC de um dia como pertencente ao dia anterior).
function inicioDoDia(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 0, 0, 0, 0));
}

function fimDoDia(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 23, 59, 59, 999));
}

// Semana corrente de segunda a domingo, contendo "hoje".
function inicioDaSemana(data: Date): Date {
  const d = inicioDoDia(data);
  const diaSemana = d.getUTCDay(); // 0 = domingo
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d;
}

function fimDaSemana(inicioSemana: Date): Date {
  const d = new Date(inicioSemana);
  d.setUTCDate(d.getUTCDate() + 6);
  return fimDoDia(d);
}

function inicioDoMes(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1, 0, 0, 0, 0));
}

function fimDoMes(data: Date): Date {
  return fimDoDia(new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)));
}

// data_inicio/data_fim ausentes = sem limite naquela ponta (usado por "safra inteira",
// que não deve excluir lançamentos com data futura à data de hoje).
type Periodo = { data_inicio?: Date; data_fim?: Date } | null;

function resolverPeriodo(query: Request['query']): Periodo {
  const { periodo, data_inicio, data_fim } = query;

  if (typeof data_inicio === 'string' && typeof data_fim === 'string') {
    const inicio = new Date(data_inicio);
    const fim = new Date(data_fim);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return null;
    return { data_inicio: inicioDoDia(inicio), data_fim: fimDoDia(fim) };
  }

  const hoje = new Date();

  switch (periodo) {
    case 'dia':
      return { data_inicio: inicioDoDia(hoje), data_fim: fimDoDia(hoje) };
    case 'semana': {
      const inicioSemana = inicioDaSemana(hoje);
      return { data_inicio: inicioSemana, data_fim: fimDaSemana(inicioSemana) };
    }
    case 'mes':
      return { data_inicio: inicioDoMes(hoje), data_fim: fimDoMes(hoje) };
    case 'safra':
      return {};
    default:
      return null;
  }
}

export async function simular(req: Request, res: Response): Promise<void> {
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

  const intervalo = resolverPeriodo(req.query);
  if (!intervalo) {
    res.status(400).json({ error: 'Informe periodo (dia, semana, mes ou safra) ou data_inicio/data_fim' });
    return;
  }

  const filtroData = {
    ...(intervalo.data_inicio && { gte: intervalo.data_inicio }),
    ...(intervalo.data_fim && { lte: intervalo.data_fim }),
  };

  const [despesas, vendas, socios] = await Promise.all([
    prisma.despesa.findMany({
      where: { safra_id: id, ...(Object.keys(filtroData).length > 0 && { data: filtroData }) },
    }),
    prisma.venda.findMany({
      where: { safra_id: id, ...(Object.keys(filtroData).length > 0 && { data: filtroData }) },
      include: { unidade: true },
    }),
    sociedadesService.listarSocios(safra.sociedade_id),
  ]);

  const resultado = calcularDivisao(
    despesas.map((d) => ({ valor: Number(d.valor) })),
    vendas.map((v) => ({ total: Number(v.total) })),
    socios.map((s) => ({ socio_id: s.id, nome: s.nome, percentual_lucro: Number(s.percentual_lucro) }))
  );

  // Soma direto da lista de vendas já buscada pro período, agrupando por unidade — não passa
  // pelo calcularDivisao (que só lida com valores monetários) pra não misturar a contagem de
  // quantidade vendida na fórmula de divisão de lucro. Agrupar por unidade evita somar
  // caixas e quilos como se fossem a mesma coisa.
  const quantidadePorUnidadeMap = new Map<string, { unidade_id: string; unidade_nome: string; quantidade: number }>();
  for (const v of vendas) {
    const acumulado = quantidadePorUnidadeMap.get(v.unidade_id);
    const quantidade = Number(v.quantidade);
    if (acumulado) {
      acumulado.quantidade += quantidade;
    } else {
      quantidadePorUnidadeMap.set(v.unidade_id, {
        unidade_id: v.unidade_id,
        unidade_nome: v.unidade.nome,
        quantidade,
      });
    }
  }

  res.json({
    periodo: { data_inicio: intervalo.data_inicio ?? null, data_fim: intervalo.data_fim ?? null },
    ...resultado,
    quantidadePorUnidade: Array.from(quantidadePorUnidadeMap.values()),
  });
}
