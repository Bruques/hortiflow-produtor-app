import { DespesaPessoal, TipoDespesa } from '@prisma/client';
import prisma from '../lib/prisma';

interface DespesaPessoalInput {
  tipo: TipoDespesa;
  valor: number;
  data: Date;
  descricao?: string;
}

export async function criarDespesaPessoal(
  safraId: string,
  usuarioId: string,
  input: DespesaPessoalInput
): Promise<DespesaPessoal> {
  return prisma.despesaPessoal.create({
    data: {
      safra_id: safraId,
      usuario_id: usuarioId,
      tipo: input.tipo,
      valor: input.valor,
      data: input.data,
      descricao: input.descricao,
    },
  });
}

// Filtra sempre por usuario_id: despesa pessoal nunca é visível a outro sócio, mesmo da mesma safra.
export async function listarDespesasPessoais(safraId: string, usuarioId: string): Promise<DespesaPessoal[]> {
  return prisma.despesaPessoal.findMany({
    where: { safra_id: safraId, usuario_id: usuarioId },
    orderBy: { data: 'desc' },
  });
}

export async function buscarDespesaPessoal(id: string): Promise<DespesaPessoal | null> {
  return prisma.despesaPessoal.findUnique({ where: { id } });
}

export async function atualizarDespesaPessoal(
  id: string,
  input: Partial<DespesaPessoalInput>
): Promise<DespesaPessoal> {
  return prisma.despesaPessoal.update({ where: { id }, data: input });
}

export async function excluirDespesaPessoal(id: string): Promise<void> {
  await prisma.despesaPessoal.delete({ where: { id } });
}
