import { Request } from 'express';

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
export type Periodo = { data_inicio?: Date; data_fim?: Date } | null;

// null = query inválida/incompleta (nem periodo reconhecido, nem par data_inicio/data_fim
// válido) — quem chama decide se isso é erro 400 ou "sem filtro".
export function resolverPeriodo(query: Request['query']): Periodo {
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

// Formato aceito pelo Prisma num `where: { data: ... }` — objeto vazio quando o período não
// restringe nenhuma ponta (ex: "safra"), pra não gerar `data: {}` sem sentido no where.
export function filtroDataPrisma(intervalo: Periodo): { gte?: Date; lte?: Date } {
  if (!intervalo) return {};
  return {
    ...(intervalo.data_inicio && { gte: intervalo.data_inicio }),
    ...(intervalo.data_fim && { lte: intervalo.data_fim }),
  };
}
