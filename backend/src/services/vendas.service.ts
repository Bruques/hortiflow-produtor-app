import { TipoGatilhoRegra, Venda } from '@prisma/client';
import prisma from '../lib/prisma';

interface CriarVendaInput {
  data: Date;
  quantidade: number;
  preco: number;
  comprador?: string;
}

export async function criarVenda(safraId: string, sociedadeId: string, input: CriarVendaInput): Promise<Venda> {
  const total = input.quantidade * input.preco;

  const venda = await prisma.venda.create({
    data: {
      safra_id: safraId,
      data: input.data,
      quantidade: input.quantidade,
      preco: input.preco,
      total,
      comprador: input.comprador,
    },
  });

  await gerarDespesasPorVenda(safraId, sociedadeId, venda);

  return venda;
}

// Regra "por caixa vendida": toda regra ativa desse tipo na sociedade gera uma
// Despesa automática proporcional à quantidade da venda recém-lançada.
async function gerarDespesasPorVenda(safraId: string, sociedadeId: string, venda: Venda): Promise<void> {
  const regras = await prisma.regraDespesaRecorrente.findMany({
    where: { sociedade_id: sociedadeId, tipo_gatilho: TipoGatilhoRegra.POR_VENDA, ativo: true },
  });

  if (regras.length === 0) return;

  await prisma.despesa.createMany({
    data: regras.map((regra) => ({
      safra_id: safraId,
      socio_id: regra.socio_id,
      tipo: regra.tipo_despesa,
      valor: Number(regra.valor) * Number(venda.quantidade),
      data: venda.data,
      regra_origem_id: regra.id,
    })),
  });
}

export async function listarVendas(safraId: string): Promise<Venda[]> {
  return prisma.venda.findMany({
    where: { safra_id: safraId },
    orderBy: { data: 'desc' },
  });
}
