import { Prisma, TipoGatilhoRegra, Venda } from '@prisma/client';
import prisma from '../lib/prisma';
import * as acertosService from './acertos.service';

type PrismaClientOuTx = typeof prisma | Prisma.TransactionClient;

interface CriarVendaInput {
  data: Date;
  quantidade: number;
  preco: number;
  comprador?: string;
  unidade_id: string;
  pago?: boolean;
  regras_por_venda_aplicadas?: string[];
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

  const regrasAplicadas = await gerarDespesasPorVenda(
    prisma,
    safraId,
    sociedadeId,
    venda,
    input.regras_por_venda_aplicadas ?? []
  );

  // `regras_aplicadas`/`coberta_por_acerto` faltavam aqui — sem eles a resposta do POST não
  // batia com o shape de `listarVendas` (mesmo bug documentado em `criarDespesa`, ver
  // despesas.service.ts). O app web nunca sentiu porque só usa a resposta como sinal de
  // sucesso e busca a lista de novo em seguida; o app mobile persiste a resposta direto no
  // cache offline pra já confirmar o registro otimista, e por isso um `undefined` aqui
  // quebrava a escrita local (docs/specs/mobile/06-vendas-e-despesa-recorrente.md). Uma venda
  // recém-criada nunca está coberta por um Acerto ainda existente sobre esse período.
  return { ...comNomeDaUnidade(venda), regras_aplicadas: regrasAplicadas, coberta_por_acerto: false };
}

// Gera Despesa só para as regras POR_VENDA que o sócio deixou marcadas na tela (opt-in
// explícito — ver adendo 2026-07-22 da spec 04). O filtro por sociedade/tipo/unidade/ativo
// continua mesmo recebendo ids explícitos, pra não confiar cegamente em id vindo do client:
// um id de outra sociedade, de outra unidade ou já desativado é ignorado silenciosamente.
// Recebe o client (global ou de uma transação) porque `atualizarVenda` precisa rodar isso
// atomicamente junto com o apagar-e-recriar das despesas antigas. Devolve os ids das regras
// de fato aplicadas, pra o create/update poder ecoar `regras_aplicadas` na resposta.
async function gerarDespesasPorVenda(
  client: PrismaClientOuTx,
  safraId: string,
  sociedadeId: string,
  venda: Venda,
  regrasAplicadas: string[]
): Promise<string[]> {
  if (regrasAplicadas.length === 0) return [];

  const regras = await client.regraDespesaRecorrente.findMany({
    where: {
      id: { in: regrasAplicadas },
      sociedade_id: sociedadeId,
      tipo_gatilho: TipoGatilhoRegra.POR_VENDA,
      unidade_id: venda.unidade_id,
      ativo: true,
    },
    include: { rateios: true },
  });

  if (regras.length === 0) return [];

  // createMany não aceita relação aninhada (rateios), então cada despesa é criada
  // individualmente quando a regra tem rateio customizado pra copiar (congelar) as linhas
  // de RateioDespesa junto — mesmo princípio usado em confirmarSugestao (docs/specs/13).
  for (const regra of regras) {
    await client.despesa.create({
      data: {
        safra_id: safraId,
        socio_id: regra.socio_id,
        tipo: regra.tipo_despesa,
        valor: Number(regra.valor) * Number(venda.quantidade),
        data: venda.data,
        regra_origem_id: regra.id,
        venda_origem_id: venda.id,
        ...(regra.rateios.length > 0 && {
          rateios: {
            create: regra.rateios.map((r) => ({
              socio_sociedade_id: r.socio_sociedade_id,
              percentual: r.percentual,
            })),
          },
        }),
      },
    });
  }

  return regras.map((r) => r.id);
}

export async function listarVendas(safraId: string, pago?: boolean, filtroData?: { gte?: Date; lte?: Date }) {
  const [vendas, intervalosAcerto] = await Promise.all([
    prisma.venda.findMany({
      where: {
        safra_id: safraId,
        ...(pago !== undefined ? { pago } : {}),
        ...(filtroData && Object.keys(filtroData).length > 0 && { data: filtroData }),
      },
      include: { unidade: true, despesasGeradas: true },
      // `data` é só a data do lançamento (sem hora) — dois registros do mesmo dia empatam nesse
      // critério. `criado_em` desempata mostrando o mais recentemente registrado primeiro.
      orderBy: [{ data: 'desc' }, { criado_em: 'desc' }],
    }),
    acertosService.listarIntervalosAcerto(safraId),
  ]);

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
    regras_aplicadas: v.despesasGeradas
      .map((d) => d.regra_origem_id)
      .filter((id): id is string => id !== null),
    // Antecipa pro frontend a mesma trava que excluir/atualizar aplicam (ver acertos.service),
    // pra desabilitar o botão antes do clique em vez de só reagir ao 409.
    coberta_por_acerto: acertosService.estaCobertaPorAcerto(v.data, intervalosAcerto),
  }));
}

export async function buscarVenda(id: string): Promise<Venda | null> {
  return prisma.venda.findUnique({ where: { id } });
}

// Editar quantidade/preço/data de uma Venda deixaria as Despesas que a regra POR_VENDA gerou
// (venda_origem_id) desatualizadas — em vez de tentar ajustar o valor delas, apaga e gera de
// novo com o valor/data atual, mesma lógica de `gerarDespesasPorVenda` usada na criação.
// Só recalcula as despesas quando `regras_por_venda_aplicadas` é enviado explicitamente —
// omitir o campo (ex: só marcando `pago`) preserva as despesas já geradas.
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

    let regrasAplicadas: string[];
    if (input.regras_por_venda_aplicadas !== undefined) {
      // RateioDespesa não tem onDelete: Cascade no schema — apagar a Despesa direto quebra por
      // FK quando ela tem rateio customizado (mesmo padrão de excluirDespesa em despesas.service).
      await tx.rateioDespesa.deleteMany({ where: { despesa: { venda_origem_id: id } } });
      await tx.despesa.deleteMany({ where: { venda_origem_id: id } });
      regrasAplicadas = await gerarDespesasPorVenda(tx, venda.safra_id, sociedadeId, venda, input.regras_por_venda_aplicadas);
    } else {
      // Campo omitido (ex: só marcando `pago`) preserva as despesas já geradas — reflete o
      // que já existe em vez de zerar, senão a resposta mentiria "nenhuma regra aplicada".
      const despesasExistentes = await tx.despesa.findMany({
        where: { venda_origem_id: id },
        select: { regra_origem_id: true },
      });
      regrasAplicadas = despesasExistentes
        .map((d) => d.regra_origem_id)
        .filter((regraId): regraId is string => regraId !== null);
    }

    // Mesmo ajuste de criarVenda: sem `regras_aplicadas`/`coberta_por_acerto` aqui, a resposta
    // do PUT não batia com `listarVendas`, e o app mobile (que confirma o cache offline direto
    // com essa resposta) quebrava. O controller já bloqueia com 409 antes de chegar aqui quando
    // a venda está coberta por um Acerto, então `coberta_por_acerto` é sempre falso nesse ponto.
    return { ...comNomeDaUnidade(venda), regras_aplicadas: regrasAplicadas, coberta_por_acerto: false };
  });
}

export async function excluirVenda(id: string): Promise<void> {
  // Mesmo motivo do rateioDespesa.deleteMany em atualizarVenda: sem apagar o rateio antes, o
  // delete da Despesa quebra por FK quando ela tem rateio customizado.
  await prisma.$transaction([
    prisma.rateioDespesa.deleteMany({ where: { despesa: { venda_origem_id: id } } }),
    prisma.despesa.deleteMany({ where: { venda_origem_id: id } }),
    prisma.venda.delete({ where: { id } }),
  ]);
}
