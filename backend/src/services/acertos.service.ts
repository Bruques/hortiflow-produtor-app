import { StatusSafra, TipoAcerto } from '@prisma/client';
import prisma from '../lib/prisma';
import * as sociedadesService from './sociedades.service';
import { calcularDivisao } from './divisao.service';

export interface AcertoSocioDetalhe {
  socio_id: string;
  nome: string;
  despesas_bancadas: number;
  percentual_aplicado: number;
  valor_lucro: number;
}

export interface AcertoDetalhado {
  id: string;
  safra_id: string;
  data_inicio: Date;
  data_fim: Date;
  tipo: TipoAcerto;
  criado_em: Date;
  receita: number;
  despesas: number;
  lucroLiquido: number;
  socios: AcertoSocioDetalhe[];
}

export interface AcertoResumo {
  id: string;
  data_inicio: Date;
  data_fim: Date;
  tipo: TipoAcerto;
  criado_em: Date;
}

// receita/despesas/lucroLiquido totais não são colunas do Acerto — são derivados dos
// AcertoSocio já persistidos (que particionam despesas e lucro entre todos os sócios),
// tanto na criação quanto na leitura. Isso garante que um Acerto antigo sempre reflita
// exatamente o que foi congelado, mesmo que Despesas/Vendas do período sejam editadas depois.
function derivarTotais(socios: AcertoSocioDetalhe[]): {
  receita: number;
  despesas: number;
  lucroLiquido: number;
} {
  const despesas = socios.reduce((acc, s) => acc + s.despesas_bancadas, 0);
  const lucroLiquido = socios.reduce((acc, s) => acc + s.valor_lucro, 0);
  return { receita: lucroLiquido + despesas, despesas, lucroLiquido };
}

type CriarAcertoResultado =
  | { erro: 'SAFRA_NAO_ENCONTRADA' }
  | { erro: 'SAFRA_NAO_EM_ANDAMENTO' }
  | { erro: 'PERIODO_INVALIDO' }
  | { erro: 'PERIODO_SOBREPOSTO' }
  | { acerto: AcertoDetalhado };

export async function criarAcerto(
  safraId: string,
  dataInicio: Date,
  dataFim: Date,
  tipo: TipoAcerto
): Promise<CriarAcertoResultado> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) {
    return { erro: 'SAFRA_NAO_ENCONTRADA' };
  }
  if (safra.status !== StatusSafra.EM_ANDAMENTO) {
    return { erro: 'SAFRA_NAO_EM_ANDAMENTO' };
  }
  if (dataInicio.getTime() > dataFim.getTime()) {
    return { erro: 'PERIODO_INVALIDO' };
  }

  const ultimoAcerto = await prisma.acerto.findFirst({
    where: { safra_id: safraId },
    orderBy: { data_fim: 'desc' },
  });
  if (ultimoAcerto && dataInicio.getTime() < ultimoAcerto.data_fim.getTime()) {
    return { erro: 'PERIODO_SOBREPOSTO' };
  }

  const filtroData = { gte: dataInicio, lte: dataFim };

  const [despesas, vendas, socios] = await Promise.all([
    prisma.despesa.findMany({ where: { safra_id: safraId, data: filtroData } }),
    prisma.venda.findMany({ where: { safra_id: safraId, data: filtroData } }),
    sociedadesService.listarSocios(safra.sociedade_id),
  ]);

  const resultado = calcularDivisao(
    despesas.map((d) => ({ valor: Number(d.valor) })),
    vendas.map((v) => ({ total: Number(v.total) })),
    socios.map((s) => ({ socio_id: s.usuario_id, nome: s.nome, percentual_lucro: Number(s.percentual_lucro) }))
  );

  const despesasBancadasPorSocio = new Map<string, number>();
  for (const d of despesas) {
    despesasBancadasPorSocio.set(d.socio_id, (despesasBancadasPorSocio.get(d.socio_id) ?? 0) + Number(d.valor));
  }

  const registro = await prisma.$transaction(async (tx) => {
    const criado = await tx.acerto.create({
      data: {
        safra_id: safraId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        tipo,
        socios: {
          create: resultado.divisao.map((div) => ({
            socio_id: div.socio_id,
            despesas_bancadas: despesasBancadasPorSocio.get(div.socio_id) ?? 0,
            percentual_aplicado: div.percentual,
            valor_lucro: div.valor,
          })),
        },
      },
      include: { socios: true },
    });

    if (tipo === TipoAcerto.FINAL) {
      await tx.safra.update({
        where: { id: safraId },
        data: { status: StatusSafra.ENCERRADA, data_fim: new Date() },
      });
    }

    return criado;
  });

  const nomesPorSocio = new Map(socios.map((s) => [s.usuario_id, s.nome]));
  const sociosDetalhe: AcertoSocioDetalhe[] = registro.socios.map((as) => ({
    socio_id: as.socio_id,
    nome: nomesPorSocio.get(as.socio_id) ?? '',
    despesas_bancadas: Number(as.despesas_bancadas),
    percentual_aplicado: Number(as.percentual_aplicado),
    valor_lucro: Number(as.valor_lucro),
  }));

  return {
    acerto: {
      id: registro.id,
      safra_id: registro.safra_id,
      data_inicio: registro.data_inicio,
      data_fim: registro.data_fim,
      tipo: registro.tipo,
      criado_em: registro.criado_em,
      ...derivarTotais(sociosDetalhe),
      socios: sociosDetalhe,
    },
  };
}

// Um Acerto é o "documento" já mostrado aos sócios (docs/specs/06) — editar ou excluir uma
// Despesa/Venda cuja data já caiu dentro de um Acerto existente deixaria esse extrato
// congelado inconsistente com a realidade. Não há FK de Despesa/Venda pra Acerto no schema
// (AcertoSocio só guarda valores já agregados), então a checagem é por data mesmo.
export async function dataCobertaPorAcerto(safraId: string, data: Date): Promise<boolean> {
  const acerto = await prisma.acerto.findFirst({
    where: { safra_id: safraId, data_inicio: { lte: data }, data_fim: { gte: data } },
  });
  return acerto !== null;
}

export async function listarAcertos(safraId: string): Promise<AcertoResumo[]> {
  return prisma.acerto.findMany({
    where: { safra_id: safraId },
    orderBy: { data_fim: 'desc' },
    select: { id: true, data_inicio: true, data_fim: true, tipo: true, criado_em: true },
  });
}

export async function buscarAcertoDetalhado(
  acertoId: string
): Promise<{ acerto: AcertoDetalhado; sociedadeId: string } | null> {
  const registro = await prisma.acerto.findUnique({
    where: { id: acertoId },
    include: { socios: true, safra: true },
  });
  if (!registro) {
    return null;
  }

  const sociosSociedade = await sociedadesService.listarSocios(registro.safra.sociedade_id);
  const nomesPorSocio = new Map(sociosSociedade.map((s) => [s.usuario_id, s.nome]));

  const sociosDetalhe: AcertoSocioDetalhe[] = registro.socios.map((as) => ({
    socio_id: as.socio_id,
    nome: nomesPorSocio.get(as.socio_id) ?? '',
    despesas_bancadas: Number(as.despesas_bancadas),
    percentual_aplicado: Number(as.percentual_aplicado),
    valor_lucro: Number(as.valor_lucro),
  }));

  return {
    sociedadeId: registro.safra.sociedade_id,
    acerto: {
      id: registro.id,
      safra_id: registro.safra_id,
      data_inicio: registro.data_inicio,
      data_fim: registro.data_fim,
      tipo: registro.tipo,
      criado_em: registro.criado_em,
      ...derivarTotais(sociosDetalhe),
      socios: sociosDetalhe,
    },
  };
}
