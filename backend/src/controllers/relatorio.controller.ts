import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';
import { podeConfigurarRegra } from '../services/regrasDespesaRecorrente.service';
import { calcularDivisao, mapearRateioParaDivisao } from '../services/divisao.service';
import { resolverPeriodo, filtroDataPrisma } from '../lib/periodo';
import { gerarRelatorioPdf } from '../services/relatorio.service';

// Reaproveita a mesma checagem de "quem banca a produção" já usada pra configurar regra
// recorrente (docs/specs/15-relatorio-pdf.md) — é o mesmo grupo de sócios que faz sentido
// levar o relatório pra contadora.
export async function gerar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const podeGerar = await podeConfigurarRegra(req.usuarioId, safra.sociedade_id);
  if (!podeGerar) {
    res.status(403).json({ error: 'Só o financiador pode gerar o relatório' });
    return;
  }

  const intervalo = resolverPeriodo(req.query);
  if (!intervalo) {
    res.status(400).json({ error: 'Informe periodo (dia, semana, mes ou safra) ou data_inicio/data_fim' });
    return;
  }
  const filtroData = filtroDataPrisma(intervalo);
  const whereData = Object.keys(filtroData).length > 0 ? { data: filtroData } : {};

  const [despesas, vendas, socios, sociedade] = await Promise.all([
    prisma.despesa.findMany({
      where: { safra_id: id, ...whereData },
      include: { rateios: true, socio: true },
      orderBy: { data: 'asc' },
    }),
    prisma.venda.findMany({
      where: { safra_id: id, ...whereData },
      include: { unidade: true },
      orderBy: { data: 'asc' },
    }),
    sociedadesService.listarSocios(safra.sociedade_id),
    prisma.sociedade.findUnique({ where: { id: safra.sociedade_id } }),
  ]);

  const divisao = calcularDivisao(
    despesas.map((d) => ({ valor: Number(d.valor), rateio: mapearRateioParaDivisao(d.rateios) })),
    vendas.map((v) => ({ total: Number(v.total) })),
    socios.map((s) => ({ socio_id: s.id, nome: s.nome, percentual_lucro: Number(s.percentual_lucro) }))
  );

  const pdf = await gerarRelatorioPdf({
    safra_nome: safra.nome,
    sociedade_nome: sociedade?.nome ?? '',
    data_inicio: intervalo.data_inicio ?? null,
    data_fim: intervalo.data_fim ?? null,
    despesas: despesas.map((d) => ({
      data: d.data,
      tipo: d.tipo,
      valor: Number(d.valor),
      socio_nome: d.socio.nome,
    })),
    vendas: vendas.map((v) => ({
      data: v.data,
      unidade_nome: v.unidade.nome,
      quantidade: Number(v.quantidade),
      preco: Number(v.preco),
      total: Number(v.total),
      pago: v.pago,
    })),
    divisao,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${safra.nome.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
  res.send(pdf);
}
