// docs/specs/21-relatorio-completo.md — dashboard de leitura no app com receita, despesas,
// lucro, divisão, quantidade/preço médio por unidade e despesas por categoria do período.
// Endpoint próprio (não estende GET /:id/simulacao) pra não inflar o payload de telas que já
// consomem simulação com frequência (Home, Resumo) com dados que só esta tela usa.
import { Request, Response } from 'express';
import { TipoDespesa } from '@prisma/client';
import prisma from '../lib/prisma';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';
import { calcularDivisao, mapearRateioParaDivisao } from '../services/divisao.service';
import { resolverPeriodo, filtroDataPrisma } from '../lib/periodo';

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

  const intervalo = resolverPeriodo(req.query);
  if (!intervalo) {
    res.status(400).json({ error: 'Informe periodo (dia, semana, mes ou safra) ou data_inicio/data_fim' });
    return;
  }

  const filtroData = filtroDataPrisma(intervalo);

  const [despesas, vendas, socios] = await Promise.all([
    prisma.despesa.findMany({
      where: { safra_id: id, ...(Object.keys(filtroData).length > 0 && { data: filtroData }) },
      include: { rateios: true },
    }),
    prisma.venda.findMany({
      where: { safra_id: id, ...(Object.keys(filtroData).length > 0 && { data: filtroData }) },
      include: { unidade: true },
    }),
    sociedadesService.listarSocios(safra.sociedade_id),
  ]);

  const resultado = calcularDivisao(
    despesas.map((d) => ({ valor: Number(d.valor), rateio: mapearRateioParaDivisao(d.rateios) })),
    vendas.map((v) => ({ total: Number(v.total) })),
    socios.map((s) => ({ socio_id: s.id, nome: s.nome, percentual_lucro: Number(s.percentual_lucro) }))
  );

  // Quantidade e preço médio por unidade, agrupados fora do calcularDivisao (que só lida com
  // valores monetários da fórmula de divisão) pra não misturar contagem de quantidade/unidade
  // com a fórmula de lucro. Preço médio = soma dos totais / soma das quantidades — não a média
  // simples do campo `preco` de cada venda, senão uma venda de 10 caixas pesaria igual a uma
  // de 1 caixa na média.
  const porUnidadeMap = new Map<string, { unidade_id: string; unidade_nome: string; quantidade: number; total: number }>();
  for (const v of vendas) {
    const acumulado = porUnidadeMap.get(v.unidade_id);
    const quantidade = Number(v.quantidade);
    const total = Number(v.total);
    if (acumulado) {
      acumulado.quantidade += quantidade;
      acumulado.total += total;
    } else {
      porUnidadeMap.set(v.unidade_id, { unidade_id: v.unidade_id, unidade_nome: v.unidade.nome, quantidade, total });
    }
  }
  const quantidadePorUnidade = Array.from(porUnidadeMap.values()).map(({ unidade_id, unidade_nome, quantidade }) => ({
    unidade_id,
    unidade_nome,
    quantidade,
  }));
  const mediaPrecoPorUnidade = Array.from(porUnidadeMap.values()).map(({ unidade_id, unidade_nome, quantidade, total }) => ({
    unidade_id,
    unidade_nome,
    media_preco: quantidade > 0 ? total / quantidade : 0,
  }));

  // Despesas por categoria (TipoDespesa) — categoria sem nenhuma despesa no período não entra
  // na resposta, pra não confundir "sem gasto" com "gasto zero".
  const porCategoriaMap = new Map<TipoDespesa, number>();
  for (const d of despesas) {
    porCategoriaMap.set(d.tipo, (porCategoriaMap.get(d.tipo) ?? 0) + Number(d.valor));
  }
  const totalDespesas = resultado.despesas;
  const despesasPorCategoria = Array.from(porCategoriaMap.entries()).map(([tipo, valor]) => ({
    tipo,
    valor,
    percentual: totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0,
  }));

  res.json({
    periodo: { data_inicio: intervalo.data_inicio ?? null, data_fim: intervalo.data_fim ?? null },
    ...resultado,
    quantidadePorUnidade,
    mediaPrecoPorUnidade,
    despesasPorCategoria,
  });
}
