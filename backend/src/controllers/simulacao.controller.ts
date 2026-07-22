import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';
import { calcularDivisao } from '../services/divisao.service';
import { resolverPeriodo, filtroDataPrisma } from '../lib/periodo';

export async function simular(req: Request, res: Response): Promise<void> {
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
    }),
    prisma.venda.findMany({
      where: { safra_id: id, ...(Object.keys(filtroData).length > 0 && { data: filtroData }) },
      include: { unidade: true },
    }),
    sociedadesService.listarSocios(safra.sociedade_id),
  ]);

  const resultado = calcularDivisao(
    despesas.map((d) => ({ valor: Number(d.valor) })),
    vendas.map((v) => ({ total: Number(v.total) })),
    socios.map((s) => ({ socio_id: s.id, nome: s.nome, percentual_lucro: Number(s.percentual_lucro) }))
  );

  // Soma direto da lista de vendas já buscada pro período, agrupando por unidade — não passa
  // pelo calcularDivisao (que só lida com valores monetários) pra não misturar a contagem de
  // quantidade vendida na fórmula de divisão de lucro. Agrupar por unidade evita somar
  // caixas e quilos como se fossem a mesma coisa.
  const quantidadePorUnidadeMap = new Map<string, { unidade_id: string; unidade_nome: string; quantidade: number }>();
  for (const v of vendas) {
    const acumulado = quantidadePorUnidadeMap.get(v.unidade_id);
    const quantidade = Number(v.quantidade);
    if (acumulado) {
      acumulado.quantidade += quantidade;
    } else {
      quantidadePorUnidadeMap.set(v.unidade_id, {
        unidade_id: v.unidade_id,
        unidade_nome: v.unidade.nome,
        quantidade,
      });
    }
  }

  res.json({
    periodo: { data_inicio: intervalo.data_inicio ?? null, data_fim: intervalo.data_fim ?? null },
    ...resultado,
    quantidadePorUnidade: Array.from(quantidadePorUnidadeMap.values()),
  });
}
