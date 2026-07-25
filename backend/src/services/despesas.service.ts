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

export type RateioCompartilhado =
  | { modo: 'igual' }
  | { modo: 'percentual'; percentuais: { safra_id: string; percentual: number }[] };

// Rateia um valor total (em reais) entre safraIds usando aritmética em centavos (inteiros)
// pra nunca sobrar diferença de arredondamento — a diferença de centavos, quando existe, é
// sempre absorvida por safraIds[0] (docs/specs/11-resumo-consolidado-e-despesa-compartilhada.md).
export function calcularValoresRateio(
  valorTotal: number,
  safraIds: string[],
  rateio: RateioCompartilhado
): Map<string, number> {
  const totalCentavos = Math.round(valorTotal * 100);
  const centavosPorSafra = new Map<string, number>();

  if (rateio.modo === 'igual') {
    const baseCentavos = Math.floor(totalCentavos / safraIds.length);
    let somaDemais = 0;
    for (let i = 1; i < safraIds.length; i++) {
      centavosPorSafra.set(safraIds[i], baseCentavos);
      somaDemais += baseCentavos;
    }
    centavosPorSafra.set(safraIds[0], totalCentavos - somaDemais);
  } else {
    const percentualPorSafra = new Map(rateio.percentuais.map((p) => [p.safra_id, p.percentual]));
    let somaDemais = 0;
    for (let i = 1; i < safraIds.length; i++) {
      const percentual = percentualPorSafra.get(safraIds[i]) ?? 0;
      const valorCentavos = Math.round((totalCentavos * percentual) / 100);
      centavosPorSafra.set(safraIds[i], valorCentavos);
      somaDemais += valorCentavos;
    }
    centavosPorSafra.set(safraIds[0], totalCentavos - somaDemais);
  }

  const valoresPorSafra = new Map<string, number>();
  for (const [safraId, centavos] of centavosPorSafra) {
    valoresPorSafra.set(safraId, centavos / 100);
  }
  return valoresPorSafra;
}

interface CriarDespesaCompartilhadaInput {
  tipo: TipoDespesa;
  valorTotal: number;
  data: Date;
  descricao?: string;
  foto_comprovante?: string;
  rateio: RateioCompartilhado;
}

// Cria uma Despesa normal em cada safra selecionada, com o valor já rateado — não existe
// tabela nova nem FK ligando as despesas geradas entre si (decisão registrada na spec 11):
// o rastro do rateio vive só como texto no início da descrição.
export async function criarDespesaCompartilhada(
  usuarioId: string,
  safraIds: string[],
  input: CriarDespesaCompartilhadaInput
) {
  const valoresPorSafra = calcularValoresRateio(input.valorTotal, safraIds, input.rateio);
  const totalFormatado = (input.valorTotal / 1).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const prefixo = `[Rateio compartilhado de ${totalFormatado}]`;
  const descricaoFinal = input.descricao ? `${prefixo} ${input.descricao}` : prefixo;

  const criacoes = safraIds.map((safraId) =>
    prisma.despesa.create({
      data: {
        safra_id: safraId,
        socio_id: usuarioId,
        tipo: input.tipo,
        valor: valoresPorSafra.get(safraId)!,
        data: input.data,
        foto_comprovante: input.foto_comprovante,
        descricao: descricaoFinal,
      },
    })
  );

  const despesas = await prisma.$transaction(criacoes);
  return safraIds.map((safraId, i) => ({ safra_id: safraId, despesa: despesas[i] }));
}

export async function listarDespesas(safraId: string, filtroData?: { gte?: Date; lte?: Date }) {
  const despesas = await prisma.despesa.findMany({
    where: {
      safra_id: safraId,
      ...(filtroData && Object.keys(filtroData).length > 0 && { data: filtroData }),
    },
    include: { socio: true },
    // `data` é só a data do lançamento (sem hora) — dois registros do mesmo dia empatam nesse
    // critério. `criado_em` desempata mostrando o mais recentemente registrado primeiro.
    orderBy: [{ data: 'desc' }, { criado_em: 'desc' }],
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
