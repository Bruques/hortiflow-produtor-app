import { TipoDespesa } from '@prisma/client';
import prisma from '../lib/prisma';

interface CriarDespesaInput {
  socio_id: string;
  tipo: TipoDespesa;
  valor: number;
  data: Date;
  foto_comprovante?: string;
  descricao?: string;
}

type AtualizarDespesaInput = Partial<CriarDespesaInput>;

export async function socioPertenceASociedade(usuarioId: string, sociedadeId: string): Promise<boolean> {
  const vinculo = await prisma.socioSociedade.findUnique({
    where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedadeId } },
  });
  return vinculo !== null;
}

export async function criarDespesa(safraId: string, input: CriarDespesaInput) {
  return prisma.despesa.create({
    data: {
      safra_id: safraId,
      socio_id: input.socio_id,
      tipo: input.tipo,
      valor: input.valor,
      data: input.data,
      foto_comprovante: input.foto_comprovante,
      descricao: input.descricao,
    },
  });
}

export async function buscarDespesa(id: string) {
  return prisma.despesa.findUnique({ where: { id } });
}

export async function atualizarDespesa(id: string, input: AtualizarDespesaInput) {
  return prisma.despesa.update({
    where: { id },
    data: {
      socio_id: input.socio_id,
      tipo: input.tipo,
      valor: input.valor,
      data: input.data,
      foto_comprovante: input.foto_comprovante,
      descricao: input.descricao,
    },
  });
}

export async function excluirDespesa(id: string): Promise<void> {
  await prisma.despesa.delete({ where: { id } });
}

export async function listarDespesas(safraId: string, filtroData?: { gte?: Date; lte?: Date }) {
  const despesas = await prisma.despesa.findMany({
    where: {
      safra_id: safraId,
      ...(filtroData && Object.keys(filtroData).length > 0 && { data: filtroData }),
    },
    include: { socio: true },
    orderBy: { data: 'desc' },
  });

  return despesas.map((d) => ({
    id: d.id,
    socio_id: d.socio_id,
    socio_nome: d.socio.nome,
    tipo: d.tipo,
    valor: d.valor,
    data: d.data,
    foto_comprovante: d.foto_comprovante,
    descricao: d.descricao,
  }));
}
