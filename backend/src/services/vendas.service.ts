import { Prisma, TipoGatilhoRegra, Venda } from '@prisma/client';
import prisma from '../lib/prisma';

type PrismaClientOuTx = typeof prisma | Prisma.TransactionClient;

interface CriarVendaInput {
  data: Date;
  quantidade: number;
  preco: number;
  comprador?: string;
}

type AtualizarVendaInput = Partial<CriarVendaInput>;

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

  await gerarDespesasPorVenda(prisma, safraId, sociedadeId, venda);

  return venda;
}

// Regra "por caixa vendida": toda regra ativa desse tipo na sociedade gera uma
// Despesa automática proporcional à quantidade da venda recém-lançada. Recebe o client
// (global ou de uma transação) porque `atualizarVenda` precisa rodar isso atomicamente
// junto com o apagar-e-recriar das despesas antigas.
async function gerarDespesasPorVenda(
  client: PrismaClientOuTx,
  safraId: string,
  sociedadeId: string,
  venda: Venda
): Promise<void> {
  const regras = await client.regraDespesaRecorrente.findMany({
    where: { sociedade_id: sociedadeId, tipo_gatilho: TipoGatilhoRegra.POR_VENDA, ativo: true },
  });

  if (regras.length === 0) return;

  await client.despesa.createMany({
    data: regras.map((regra) => ({
      safra_id: safraId,
      socio_id: regra.socio_id,
      tipo: regra.tipo_despesa,
      valor: Number(regra.valor) * Number(venda.quantidade),
      data: venda.data,
      regra_origem_id: regra.id,
      venda_origem_id: venda.id,
    })),
  });
}

export async function listarVendas(safraId: string): Promise<Venda[]> {
  return prisma.venda.findMany({
    where: { safra_id: safraId },
    orderBy: { data: 'desc' },
  });
}

export async function buscarVenda(id: string): Promise<Venda | null> {
  return prisma.venda.findUnique({ where: { id } });
}

// Editar quantidade/preço/data de uma Venda deixaria as Despesas que a regra POR_VENDA gerou
// (venda_origem_id) desatualizadas — em vez de tentar ajustar o valor delas, apaga e gera de
// novo com o valor/data atual, mesma lógica de `gerarDespesasPorVenda` usada na criação.
export async function atualizarVenda(
  id: string,
  sociedadeId: string,
  input: AtualizarVendaInput
): Promise<Venda> {
  const atual = await prisma.venda.findUniqueOrThrow({ where: { id } });
  const quantidade = input.quantidade ?? Number(atual.quantidade);
  const preco = input.preco ?? Number(atual.preco);

  return prisma.$transaction(async (tx) => {
    const venda = await tx.venda.update({
      where: { id },
      data: {
        data: input.data,
        quantidade,
        preco,
        total: quantidade * preco,
        comprador: input.comprador,
      },
    });

    await tx.despesa.deleteMany({ where: { venda_origem_id: id } });
    await gerarDespesasPorVenda(tx, venda.safra_id, sociedadeId, venda);

    return venda;
  });
}

export async function excluirVenda(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.despesa.deleteMany({ where: { venda_origem_id: id } }),
    prisma.venda.delete({ where: { id } }),
  ]);
}
