import { Safra, StatusSafra } from '@prisma/client';
import prisma from '../lib/prisma';
import { ehSocio } from './sociedades.service';

export async function abrirSafra(sociedadeId: string, nome: string, observacoes?: string): Promise<Safra> {
  return prisma.safra.create({
    data: {
      sociedade_id: sociedadeId,
      nome,
      observacoes: observacoes || null,
      status: StatusSafra.EM_ANDAMENTO,
      data_inicio: new Date(),
    },
  });
}

export async function listarSafras(sociedadeId: string): Promise<Safra[]> {
  return prisma.safra.findMany({
    where: { sociedade_id: sociedadeId },
    orderBy: { criado_em: 'desc' },
  });
}

// Lista as safras de TODAS as sociedades do usuário, não só uma — base da tela de entrada
// pós-login (docs/design/notas-de-design.md): o usuário pensa em "minhas safras", não em
// "minhas sociedades", então a navegação depois do login parte daqui, não de uma sociedade.
export async function listarSafrasDoUsuario(usuarioId: string) {
  const safras = await prisma.safra.findMany({
    where: { sociedade: { socios: { some: { usuario_id: usuarioId } } } },
    include: { sociedade: { select: { nome: true } } },
    orderBy: { criado_em: 'desc' },
  });

  return safras.map((s) => ({
    id: s.id,
    sociedade_id: s.sociedade_id,
    sociedade_nome: s.sociedade.nome,
    nome: s.nome,
    observacoes: s.observacoes,
    status: s.status,
    data_inicio: s.data_inicio,
    data_fim: s.data_fim,
  }));
}

// Centraliza a checagem "usuário é sócio da sociedade dona dessa safra", usada por
// despesas e despesas pessoais também, pra não duplicar o join safra -> sociedade em cada controller.
export async function ehSocioDaSafra(
  usuarioId: string,
  safraId: string
): Promise<{ safra: Safra | null; autorizado: boolean }> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) {
    return { safra: null, autorizado: false };
  }
  const autorizado = await ehSocio(usuarioId, safra.sociedade_id);
  return { safra, autorizado };
}

export async function atualizarObservacoes(
  safraId: string,
  observacoes: string | null
): Promise<Safra | null> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) return null;

  return prisma.safra.update({
    where: { id: safraId },
    data: { observacoes },
  });
}

type EncerrarResultado =
  | { erro: 'NAO_ENCONTRADA' }
  | { erro: 'JA_ENCERRADA' }
  | { safra: Safra };

export async function encerrarSafra(safraId: string): Promise<EncerrarResultado> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) {
    return { erro: 'NAO_ENCONTRADA' };
  }
  if (safra.status === StatusSafra.ENCERRADA) {
    return { erro: 'JA_ENCERRADA' };
  }

  const atualizada = await prisma.safra.update({
    where: { id: safraId },
    data: { status: StatusSafra.ENCERRADA, data_fim: new Date() },
  });

  return { safra: atualizada };
}
