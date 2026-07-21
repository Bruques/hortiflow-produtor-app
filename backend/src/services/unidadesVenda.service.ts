import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export async function criarUnidade(sociedadeId: string, nome: string) {
  // Verifica duplicidade sem diferenciar maiúsculas/minúsculas antes de tentar criar — a
  // constraint única do banco (@@unique) é case-sensitive, então isso cobre o caso
  // "Caixa" vs "caixa" que o índice sozinho deixaria passar.
  const existente = await prisma.unidadeVenda.findFirst({
    where: { sociedade_id: sociedadeId, nome: { equals: nome, mode: 'insensitive' } },
  });
  if (existente) {
    return { erro: 'NOME_DUPLICADO' as const };
  }

  try {
    return { unidade: await prisma.unidadeVenda.create({ data: { sociedade_id: sociedadeId, nome } }) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { erro: 'NOME_DUPLICADO' as const };
    }
    throw err;
  }
}

export async function listarUnidades(sociedadeId: string) {
  return prisma.unidadeVenda.findMany({
    where: { sociedade_id: sociedadeId },
    orderBy: { criado_em: 'asc' },
  });
}

export async function buscarUnidadePorId(unidadeId: string) {
  return prisma.unidadeVenda.findUnique({ where: { id: unidadeId } });
}

export async function unidadePertenceASociedade(unidadeId: string, sociedadeId: string): Promise<boolean> {
  const unidade = await prisma.unidadeVenda.findUnique({ where: { id: unidadeId } });
  return unidade !== null && unidade.sociedade_id === sociedadeId;
}

type AtualizarAtivoResultado =
  | { erro: 'NAO_ENCONTRADA' }
  | { unidade: { id: string; ativo: boolean }; sociedade_id: string };

export async function atualizarAtivo(unidadeId: string, ativo: boolean): Promise<AtualizarAtivoResultado> {
  const unidade = await prisma.unidadeVenda.findUnique({ where: { id: unidadeId } });
  if (!unidade) {
    return { erro: 'NAO_ENCONTRADA' };
  }

  const atualizada = await prisma.unidadeVenda.update({ where: { id: unidadeId }, data: { ativo } });
  return { unidade: { id: atualizada.id, ativo: atualizada.ativo }, sociedade_id: atualizada.sociedade_id };
}
