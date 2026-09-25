import { PapelSocio, RateioRegra, SocioSociedade, TipoDespesa, TipoGatilhoRegra, Usuario } from '@prisma/client';
import prisma from '../lib/prisma';

export interface RateioInput {
  socio_id: string;
  percentual: number;
}

interface CriarRegraInput {
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: number;
  unidade_id?: string;
  // Spec 30 — ausente = regra global (vale em todas as lavouras da sociedade, comportamento
  // legado); presente = regra só dessa lavoura.
  safra_id?: string;
  // Ausente = despesas geradas pela regra seguem o rateio padrão (percentual de lucro
  // vigente); ver docs/specs/13-rateio-de-despesas.md. Definido só na criação — não há
  // endpoint pra editar o rateio de uma regra já existente.
  rateio?: RateioInput[];
}

type RateioComSocio = RateioRegra & { socioSociedade: SocioSociedade & { usuario: Usuario | null } };

function mapearRateio(rateios: RateioComSocio[]): { socio_id: string; socio_nome: string; percentual: number }[] | null {
  if (rateios.length === 0) return null;
  return rateios.map((r) => ({
    socio_id: r.socio_sociedade_id,
    socio_nome: r.socioSociedade.usuario?.nome ?? r.socioSociedade.nome ?? '',
    percentual: Number(r.percentual),
  }));
}

// Mesma validação usada em Despesa (docs/specs/13): todo socio_id precisa ser um
// SocioSociedade da mesma sociedade e a soma dos percentuais precisa fechar em 100%.
export async function rateioValido(sociedadeId: string, rateio: RateioInput[]): Promise<boolean> {
  if (rateio.length === 0) return false;
  const soma = rateio.reduce((acc, r) => acc + r.percentual, 0);
  if (Math.abs(soma - 100) > 0.01) return false;

  const encontrados = await prisma.socioSociedade.count({
    where: { id: { in: rateio.map((r) => r.socio_id) }, sociedade_id: sociedadeId },
  });
  return encontrados === new Set(rateio.map((r) => r.socio_id)).size;
}

// Só FINANCIADOR ou MISTO configuram regra recorrente — MISTO também banca a
// produção, então é tratado como financiador para esse fim (ver spec da task 4).
export async function podeConfigurarRegra(usuarioId: string, sociedadeId: string): Promise<boolean> {
  const vinculo = await prisma.socioSociedade.findUnique({
    where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedadeId } },
  });
  if (!vinculo) return false;
  return vinculo.papel === PapelSocio.FINANCIADOR || vinculo.papel === PapelSocio.MISTO;
}

export async function socioPertenceASociedade(usuarioId: string, sociedadeId: string): Promise<boolean> {
  const vinculo = await prisma.socioSociedade.findUnique({
    where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedadeId } },
  });
  return vinculo !== null;
}

// Spec 30 — filtro "vale nesta lavoura": regra da própria lavoura OU global (safra_id nulo).
function valeNaSafra(safraId: string) {
  return { OR: [{ safra_id: safraId }, { safra_id: null }] };
}

// Spec 30 — a lavoura da regra precisa ser da sociedade da URL.
export async function safraPertenceASociedade(safraId: string, sociedadeId: string): Promise<boolean> {
  const safra = await prisma.safra.findFirst({ where: { id: safraId, sociedade_id: sociedadeId }, select: { id: true } });
  return safra !== null;
}

// Spec 30 — regra de lavoura só pode ratear entre sócios que estão naquela lavoura (SocioSafra),
// senão "só o João paga na A" poderia incluir a Maria, que só existe na B.
export async function rateioValidoNaSafra(safraId: string, rateio: RateioInput[]): Promise<boolean> {
  const ids = new Set(rateio.map((r) => r.socio_id));
  const naSafra = await prisma.socioSafra.count({
    where: { safra_id: safraId, socio_sociedade_id: { in: [...ids] } },
  });
  return naSafra === ids.size;
}

export async function criarRegra(sociedadeId: string, criadoPor: string, input: CriarRegraInput) {
  const regra = await prisma.regraDespesaRecorrente.create({
    data: {
      sociedade_id: sociedadeId,
      // A despesa gerada é sempre atribuída a quem criou a regra — ver adendo 2026-07-31 em
      // docs/specs/04-vendas-e-despesa-recorrente.md. Só FINANCIADOR/MISTO criam regra, e
      // esse campo é só auditoria (não afeta calcularDivisao, que usa o rateio).
      socio_id: criadoPor,
      safra_id: input.safra_id ?? null,
      criado_por: criadoPor,
      tipo_gatilho: input.tipo_gatilho,
      tipo_despesa: input.tipo_despesa,
      valor: input.valor,
      // POR_PERIODO nunca tem unidade — não está amarrada a uma Venda específica
      unidade_id: input.tipo_gatilho === TipoGatilhoRegra.POR_VENDA ? input.unidade_id : null,
      ...(input.rateio && {
        rateios: {
          create: input.rateio.map((r) => ({ socio_sociedade_id: r.socio_id, percentual: r.percentual })),
        },
      }),
    },
    include: { rateios: { include: { socioSociedade: { include: { usuario: true } } } } },
  });
  const { rateios, ...resto } = regra;
  return { ...resto, rateio: mapearRateio(rateios) };
}

// `safraId` ausente = todas as regras da sociedade (comportamento legado, usado por clientes
// que ainda não enviam a lavoura); presente = as da lavoura + as globais (spec 30).
export async function listarRegras(sociedadeId: string, safraId?: string) {
  const regras = await prisma.regraDespesaRecorrente.findMany({
    where: { sociedade_id: sociedadeId, ...(safraId && valeNaSafra(safraId)) },
    include: {
      socio: true,
      unidade: true,
      rateios: { include: { socioSociedade: { include: { usuario: true } } } },
    },
    orderBy: { criado_em: 'desc' },
  });

  return regras.map((r) => ({
    id: r.id,
    socio_id: r.socio_id,
    socio_nome: r.socio.nome,
    tipo_gatilho: r.tipo_gatilho,
    tipo_despesa: r.tipo_despesa,
    valor: r.valor,
    unidade_id: r.unidade_id,
    unidade_nome: r.unidade?.nome ?? null,
    safra_id: r.safra_id,
    ativo: r.ativo,
    criado_por: r.criado_por,
    rateio: mapearRateio(r.rateios),
  }));
}

type AtualizarAtivoResultado =
  | { erro: 'NAO_ENCONTRADA' }
  | { regra: { id: string; ativo: boolean }; sociedade_id: string };

export async function atualizarAtivo(regraId: string, ativo: boolean): Promise<AtualizarAtivoResultado> {
  const regra = await prisma.regraDespesaRecorrente.findUnique({ where: { id: regraId } });
  if (!regra) {
    return { erro: 'NAO_ENCONTRADA' };
  }

  const atualizada = await prisma.regraDespesaRecorrente.update({
    where: { id: regraId },
    data: { ativo },
  });

  return { regra: { id: atualizada.id, ativo: atualizada.ativo }, sociedade_id: atualizada.sociedade_id };
}

export async function buscarRegraPorId(regraId: string) {
  return prisma.regraDespesaRecorrente.findUnique({ where: { id: regraId } });
}

interface AtualizarRegraInput {
  tipo_despesa: TipoDespesa;
  valor: number;
  unidade_id?: string;
  rateio?: RateioInput[];
}

// Edita valor/tipo_despesa/unidade/rateio de uma regra já criada (docs/specs/04, adendo
// 2026-08-04). Nunca toca em Despesa já gerada — ela guarda uma cópia própria dos dados no
// momento da criação (mesmo princípio do Acerto), então editar a regra só muda o que ela vai
// gerar dali pra frente. tipo_gatilho, ativo, socio_id e criado_por não são editáveis aqui.
export async function atualizarRegra(regraId: string, input: AtualizarRegraInput) {
  const regra = await prisma.regraDespesaRecorrente.update({
    where: { id: regraId },
    data: {
      tipo_despesa: input.tipo_despesa,
      valor: input.valor,
      unidade_id: input.unidade_id ?? null,
      rateios: {
        deleteMany: {},
        ...(input.rateio && {
          create: input.rateio.map((r) => ({ socio_sociedade_id: r.socio_id, percentual: r.percentual })),
        }),
      },
    },
    include: { rateios: { include: { socioSociedade: { include: { usuario: true } } } } },
  });
  const { rateios, ...resto } = regra;
  return { ...resto, rateio: mapearRateio(rateios) };
}

// Valida os ids marcados na tela de Venda (`regras_por_venda_aplicadas`) antes de repassar
// pro service de vendas: todos precisam ser regra POR_VENDA ativa, da Sociedade, da lavoura (ou global, spec 30) e da unidade
// da venda — evita que um id de outra sociedade/unidade ou desativado passe direto.
export async function todasRegrasPorVendaValidas(
  sociedadeId: string,
  safraId: string,
  unidadeId: string,
  ids: string[]
): Promise<boolean> {
  if (ids.length === 0) return true;

  const encontradas = await prisma.regraDespesaRecorrente.count({
    where: {
      id: { in: ids },
      sociedade_id: sociedadeId,
      ...valeNaSafra(safraId),
      unidade_id: unidadeId,
      tipo_gatilho: TipoGatilhoRegra.POR_VENDA,
      ativo: true,
    },
  });

  return encontradas === ids.length;
}

export async function listarSugestoesDoDia(safraId: string, sociedadeId: string) {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const regras = await prisma.regraDespesaRecorrente.findMany({
    where: {
      sociedade_id: sociedadeId,
      ...valeNaSafra(safraId),
      tipo_gatilho: TipoGatilhoRegra.POR_PERIODO,
      ativo: true,
    },
    include: { socio: true },
  });

  const confirmadasHoje = await prisma.despesa.findMany({
    where: {
      safra_id: safraId,
      data: { gte: inicioDoDia },
      regra_origem_id: { in: regras.map((r) => r.id) },
    },
    select: { regra_origem_id: true },
  });
  const idsConfirmados = new Set(confirmadasHoje.map((d) => d.regra_origem_id));

  return regras
    .filter((r) => !idsConfirmados.has(r.id))
    .map((r) => ({
      id: r.id,
      socio_id: r.socio_id,
      socio_nome: r.socio.nome,
      tipo_despesa: r.tipo_despesa,
      valor: r.valor,
    }));
}

type ConfirmarResultado =
  | { erro: 'NAO_ENCONTRADA' }
  | { erro: 'JA_CONFIRMADA' }
  | { despesa: Awaited<ReturnType<typeof prisma.despesa.create>> };

export async function confirmarSugestao(safraId: string, regraId: string): Promise<ConfirmarResultado> {
  const regra = await prisma.regraDespesaRecorrente.findUnique({
    where: { id: regraId },
    include: { rateios: true },
  });
  // Spec 30 — regra de outra lavoura responde como inexistente (safra_id nulo = global, vale em todas)
  if (
    !regra ||
    !regra.ativo ||
    regra.tipo_gatilho !== TipoGatilhoRegra.POR_PERIODO ||
    (regra.safra_id !== null && regra.safra_id !== safraId)
  ) {
    return { erro: 'NAO_ENCONTRADA' };
  }

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const jaConfirmada = await prisma.despesa.findFirst({
    where: { safra_id: safraId, regra_origem_id: regraId, data: { gte: inicioDoDia } },
  });
  if (jaConfirmada) {
    return { erro: 'JA_CONFIRMADA' };
  }

  const despesa = await prisma.despesa.create({
    data: {
      safra_id: safraId,
      socio_id: regra.socio_id,
      tipo: regra.tipo_despesa,
      valor: regra.valor,
      data: new Date(),
      regra_origem_id: regra.id,
      // Copia (congela) o rateio da regra pra despesa gerada — não referencia a regra ao
      // vivo, mesmo princípio do `percentual_aplicado` do Acerto (docs/specs/13).
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

  return { despesa };
}
