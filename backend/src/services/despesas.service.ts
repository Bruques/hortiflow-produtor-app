import { TipoDespesa, RateioDespesa, SocioSociedade, Usuario } from '@prisma/client';
import prisma from '../lib/prisma';
import * as acertosService from './acertos.service';

export interface RateioInput {
  socio_id: string;
  percentual: number;
}

type RateioComSocio = RateioDespesa & { socioSociedade: SocioSociedade & { usuario: Usuario | null } };

// null representa "rateio padrão" (nenhuma linha em RateioDespesa) — não confundir com
// array vazio, que não deveria acontecer (soma teria que fechar em 100%).
function mapearRateio(rateios: RateioComSocio[]): { socio_id: string; socio_nome: string; percentual: number }[] | null {
  if (rateios.length === 0) return null;
  return rateios.map((r) => ({
    socio_id: r.socio_sociedade_id,
    socio_nome: r.socioSociedade.usuario?.nome ?? r.socioSociedade.nome ?? '',
    percentual: Number(r.percentual),
  }));
}

interface CriarDespesaInput {
  socio_id: string;
  tipo: TipoDespesa;
  valor: number;
  data: Date;
  foto_comprovante?: string;
  descricao?: string;
  // Ausente = rateio padrão (segue o percentual_lucro vigente); ver docs/specs/13-rateio-de-despesas.md.
  rateio?: RateioInput[];
}

// Não é Partial<CriarDespesaInput> porque `rateio` aqui distingue 3 estados: ausente (não
// mexe no rateio atual), `null` (remove o rateio customizado, volta ao padrão) ou array
// (substitui) — Partial só daria ausente/array.
type AtualizarDespesaInput = Partial<Omit<CriarDespesaInput, 'rateio'>> & { rateio?: RateioInput[] | null };

export async function socioPertenceASociedade(usuarioId: string, sociedadeId: string): Promise<boolean> {
  const vinculo = await prisma.socioSociedade.findUnique({
    where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedadeId } },
  });
  return vinculo !== null;
}

// Valida que todo socio_id do rateio é um SocioSociedade da mesma sociedade e que a soma
// dos percentuais fecha em 100% (tolerância 0.01, mesma da spec 11).
export async function rateioValido(sociedadeId: string, rateio: RateioInput[]): Promise<boolean> {
  if (rateio.length === 0) return false;
  const soma = rateio.reduce((acc, r) => acc + r.percentual, 0);
  if (Math.abs(soma - 100) > 0.01) return false;

  const encontrados = await prisma.socioSociedade.count({
    where: { id: { in: rateio.map((r) => r.socio_id) }, sociedade_id: sociedadeId },
  });
  return encontrados === new Set(rateio.map((r) => r.socio_id)).size;
}

export async function criarDespesa(safraId: string, input: CriarDespesaInput) {
  const despesa = await prisma.despesa.create({
    data: {
      safra_id: safraId,
      socio_id: input.socio_id,
      tipo: input.tipo,
      valor: input.valor,
      data: input.data,
      foto_comprovante: input.foto_comprovante,
      descricao: input.descricao,
      ...(input.rateio && {
        rateios: {
          create: input.rateio.map((r) => ({ socio_sociedade_id: r.socio_id, percentual: r.percentual })),
        },
      }),
    },
    // `socio: true` faltava aqui — sem isso a resposta do POST não carregava `socio_nome`,
    // diferente de `listarDespesas`. O app web nunca sentiu porque só usa a resposta do POST
    // como sinal de sucesso e busca a lista de novo em seguida; o app mobile usa a resposta
    // na hora pra já confirmar o registro otimista local, e por isso expôs a falta do campo
    // (ver docs/specs/mobile/04-despesas-da-sociedade.md, decisões registradas).
    include: { socio: true, rateios: { include: { socioSociedade: { include: { usuario: true } } } } },
  });
  const { rateios, socio, ...resto } = despesa;
  return { ...resto, socio_nome: socio.nome, rateio: mapearRateio(rateios) };
}

export async function buscarDespesa(id: string) {
  return prisma.despesa.findUnique({ where: { id } });
}

export async function atualizarDespesa(id: string, input: AtualizarDespesaInput) {
  return prisma.$transaction(async (tx) => {
    if (input.rateio !== undefined) {
      await tx.rateioDespesa.deleteMany({ where: { despesa_id: id } });
      if (input.rateio !== null) {
        await tx.rateioDespesa.createMany({
          data: input.rateio.map((r) => ({
            despesa_id: id,
            socio_sociedade_id: r.socio_id,
            percentual: r.percentual,
          })),
        });
      }
    }

    const despesa = await tx.despesa.update({
      where: { id },
      data: {
        socio_id: input.socio_id,
        tipo: input.tipo,
        valor: input.valor,
        data: input.data,
        foto_comprovante: input.foto_comprovante,
        descricao: input.descricao,
      },
      // Mesmo ajuste de criarDespesa: `socio: true` é o que dá o `socio_nome` na resposta.
      include: { socio: true, rateios: { include: { socioSociedade: { include: { usuario: true } } } } },
    });
    const { rateios, socio, ...resto } = despesa;
    return { ...resto, socio_nome: socio.nome, rateio: mapearRateio(rateios) };
  });
}

export async function excluirDespesa(id: string): Promise<void> {
  // RateioDespesa não tem onDelete: Cascade no schema — apagar a Despesa direto quebra
  // por FK quando ela tem rateio customizado (mesmo padrão de excluirVenda em vendas.service).
  await prisma.$transaction([
    prisma.rateioDespesa.deleteMany({ where: { despesa_id: id } }),
    prisma.despesa.delete({ where: { id } }),
  ]);
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
  const [despesas, intervalosAcerto] = await Promise.all([
    prisma.despesa.findMany({
      where: {
        safra_id: safraId,
        ...(filtroData && Object.keys(filtroData).length > 0 && { data: filtroData }),
      },
      include: { socio: true, rateios: { include: { socioSociedade: { include: { usuario: true } } } } },
      // `data` é só a data do lançamento (sem hora) — dois registros do mesmo dia empatam nesse
      // critério. `criado_em` desempata mostrando o mais recentemente registrado primeiro.
      orderBy: [{ data: 'desc' }, { criado_em: 'desc' }],
    }),
    acertosService.listarIntervalosAcerto(safraId),
  ]);

  return despesas.map((d) => ({
    id: d.id,
    socio_id: d.socio_id,
    socio_nome: d.socio.nome,
    tipo: d.tipo,
    valor: d.valor,
    data: d.data,
    foto_comprovante: d.foto_comprovante,
    descricao: d.descricao,
    rateio: mapearRateio(d.rateios),
    // Antecipa pro frontend a mesma trava que excluir/atualizar aplicam (ver acertos.service),
    // pra desabilitar o botão antes do clique em vez de só reagir ao 409.
    coberta_por_acerto: acertosService.estaCobertaPorAcerto(d.data, intervalosAcerto),
  }));
}
