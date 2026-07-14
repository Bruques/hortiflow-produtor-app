import { PapelSocio, TipoDespesa, TipoGatilhoRegra } from '@prisma/client';
import prisma from '../lib/prisma';

interface CriarRegraInput {
  socio_id: string;
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: number;
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

export async function criarRegra(sociedadeId: string, criadoPor: string, input: CriarRegraInput) {
  return prisma.regraDespesaRecorrente.create({
    data: {
      sociedade_id: sociedadeId,
      socio_id: input.socio_id,
      criado_por: criadoPor,
      tipo_gatilho: input.tipo_gatilho,
      tipo_despesa: input.tipo_despesa,
      valor: input.valor,
    },
  });
}

export async function listarRegras(sociedadeId: string) {
  const regras = await prisma.regraDespesaRecorrente.findMany({
    where: { sociedade_id: sociedadeId },
    include: { socio: true },
    orderBy: { criado_em: 'desc' },
  });

  return regras.map((r) => ({
    id: r.id,
    socio_id: r.socio_id,
    socio_nome: r.socio.nome,
    tipo_gatilho: r.tipo_gatilho,
    tipo_despesa: r.tipo_despesa,
    valor: r.valor,
    ativo: r.ativo,
    criado_por: r.criado_por,
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

export async function listarSugestoesDoDia(safraId: string, sociedadeId: string) {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const regras = await prisma.regraDespesaRecorrente.findMany({
    where: { sociedade_id: sociedadeId, tipo_gatilho: TipoGatilhoRegra.POR_PERIODO, ativo: true },
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
  const regra = await prisma.regraDespesaRecorrente.findUnique({ where: { id: regraId } });
  if (!regra || !regra.ativo || regra.tipo_gatilho !== TipoGatilhoRegra.POR_PERIODO) {
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
    },
  });

  return { despesa };
}
