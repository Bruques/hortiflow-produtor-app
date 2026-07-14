import { TipoDespesa } from '@prisma/client';
import prisma from '../lib/prisma';

interface CriarDespesaInput {
  socio_id: string;
  tipo: TipoDespesa;
  valor: number;
  data: Date;
  foto_comprovante?: string;
}

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
    },
  });
}

export async function listarDespesas(safraId: string) {
  const despesas = await prisma.despesa.findMany({
    where: { safra_id: safraId },
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
  }));
}
