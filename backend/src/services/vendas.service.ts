import { Prisma, TipoGatilhoRegra, Venda } from '@prisma/client';
import prisma from '../lib/prisma';

type PrismaClientOuTx = typeof prisma | Prisma.TransactionClient;

interface CriarVendaInput {
  data: Date;
  quantidade: number;
  preco: number;
  comprador?: string;
  unidade_id: string;
  pago?: boolean;
}

type AtualizarVendaInput = Partial<CriarVendaInput>;

function comNomeDaUnidade(venda: Venda & { unidade: { nome: string } }) {
  return {
    id: venda.id,
    safra_id: venda.safra_id,
    data: venda.data,
    quantidade: venda.quantidade,
    preco: venda.preco,
    total: venda.total,
    comprador: venda.comprador,
    pago: venda.pago,
    unidade_id: venda.unidade_id,
    unidade_nome: venda.unidade.nome,
    criado_em: venda.criado_em,
  };
}

export async function criarVenda(safraId: string, sociedadeId: string, input: CriarVendaInput) {
  const total = input.quantidade * input.preco;

  const venda = await prisma.venda.create({
    data: {
      safra_id: safraId,
      data: input.data,
      quantidade: input.quantidade,
      preco: input.preco,
      total,
      comprador: input.comprador,
      unidade_id: input.unidade_id,
      pago: input.pago ?? false,
    },
    include: { unidade: true },
  });

  await gerarDespesasPorVenda(prisma, safraId, sociedadeId, venda);

  return comNomeDaUnidade(venda);
}

// Regra "por caixa vendida" (ou por qualquer outra unidade): toda regra ativa desse tipo
// **na mesma unidade da venda** gera uma Despesa automática proporcional à quantidade
// vendida. Recebe o client (global ou de uma transação) porque `atualizarVenda` precisa
// rodar isso atomicamente junto com o apagar-e-recriar das despesas antigas.
async function gerarDespesasPorVenda(
  client: PrismaClientOuTx,
  safraId: string,
  sociedadeId: string,
  venda: Venda
): Promise<void> {
  const regras = await client.regraDespesaRecorrente.findMany({
    where: {
      sociedade_id: sociedadeId,
      tipo_gatilho: TipoGatilhoRegra.POR_VENDA,
      unidade_id: venda.unidade_id,
      ativo: true,
    },
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

export async function listarVendas(safraId: string, pago?: boolean) {
  const vendas = await prisma.venda.findMany({
    where: { safra_id: safraId, ...(pago !== undefined ? { pago } : {}) },
    include: { unidade: true },
    orderBy: { data: 'desc' },
  });

  return vendas.map((v) => ({
    id: v.id,
    safra_id: v.safra_id,
    data: v.data,
    quantidade: v.quantidade,
    preco: v.preco,
    total: v.total,
    comprador: v.comprador,
    pago: v.pago,
    unidade_id: v.unidade_id,
    unidade_nome: v.unidade.nome,
    criado_em: v.criado_em,
  }));
}

export async function buscarVenda(id: string): Promise<Venda | null> {
  return prisma.venda.findUnique({ where: { id } });
}

// Editar quantidade/preço/data de uma Venda deixaria as Despesas que a regra POR_VENDA gerou
// (venda_origem_id) desatualizadas — em vez de tentar ajustar o valor delas, apaga e gera de
// novo com o valor/data atual, mesma lógica de `gerarDespesasPorVenda` usada na criação.
export async function atualizarVenda(id: string, sociedadeId: string, input: AtualizarVendaInput) {
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
        pago: input.pago ?? atual.pago,
        unidade_id: input.unidade_id ?? atual.unidade_id,
      },
      include: { unidade: true },
    });

    await tx.despesa.deleteMany({ where: { venda_origem_id: id } });
    await gerarDespesasPorVenda(tx, venda.safra_id, sociedadeId, venda);

    return comNomeDaUnidade(venda);
  });
}

export async function excluirVenda(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.despesa.deleteMany({ where: { venda_origem_id: id } }),
    prisma.venda.delete({ where: { id } }),
  ]);
}
