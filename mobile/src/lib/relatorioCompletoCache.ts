// docs/specs/mobile/10-relatorio-completo.md — mesmo padrão cache-then-network de
// simulacaoCache.ts, exigido pelo CLAUDE.md pra qualquer tela de leitura: mostra o último
// dado salvo localmente e só avisa erro visível se não havia nada em cache pro filtro atual.
import { getDatabase } from './database';
import type {
  DespesaPorCategoria,
  DivisaoSocio,
  MediaPrecoPorUnidade,
  PeriodoFiltro,
  QuantidadePorUnidade,
  RelatorioCompleto,
} from '../types/simulacao';

export type FiltroRelatorioCompleto = { periodo: PeriodoFiltro } | { dataInicio: string; dataFim: string };

interface RelatorioCompletoCacheRow {
  data_inicio: string | null;
  data_fim: string | null;
  receita: string;
  despesas: string;
  lucro_liquido: string;
  divisao: string;
  quantidade_por_unidade: string;
  media_preco_por_unidade: string;
  despesas_por_categoria: string;
  atualizado_em: string;
}

export interface RelatorioCompletoCacheado {
  relatorio: RelatorioCompleto;
  atualizadoEm: string;
}

// Uma linha por combinação de safra+filtro, mesmo critério de simulacaoCache.ts — distingue
// "esse período nunca foi carregado" de "esse período foi carregado e deu zero".
function chave(safraId: string, filtro: FiltroRelatorioCompleto): string {
  if ('periodo' in filtro) return `${safraId}:periodo:${filtro.periodo}`;
  return `${safraId}:custom:${filtro.dataInicio}:${filtro.dataFim}`;
}

export async function salvarRelatorioCompletoCache(
  safraId: string,
  filtro: FiltroRelatorioCompleto,
  relatorio: RelatorioCompleto
): Promise<string> {
  const db = await getDatabase();
  const atualizadoEm = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO relatorio_completo_cache
      (chave, safra_id, data_inicio, data_fim, receita, despesas, lucro_liquido, divisao,
       quantidade_por_unidade, media_preco_por_unidade, despesas_por_categoria, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chave(safraId, filtro),
      safraId,
      relatorio.periodo.data_inicio,
      relatorio.periodo.data_fim,
      String(relatorio.receita),
      String(relatorio.despesas),
      String(relatorio.lucroLiquido),
      JSON.stringify(relatorio.divisao),
      JSON.stringify(relatorio.quantidadePorUnidade),
      JSON.stringify(relatorio.mediaPrecoPorUnidade),
      JSON.stringify(relatorio.despesasPorCategoria),
      atualizadoEm,
    ]
  );
  return atualizadoEm;
}

export async function obterRelatorioCompletoCache(
  safraId: string,
  filtro: FiltroRelatorioCompleto
): Promise<RelatorioCompletoCacheado | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RelatorioCompletoCacheRow>(
    'SELECT * FROM relatorio_completo_cache WHERE chave = ?',
    [chave(safraId, filtro)]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    relatorio: {
      periodo: { data_inicio: row.data_inicio, data_fim: row.data_fim },
      receita: Number(row.receita),
      despesas: Number(row.despesas),
      lucroLiquido: Number(row.lucro_liquido),
      divisao: JSON.parse(row.divisao) as DivisaoSocio[],
      quantidadePorUnidade: JSON.parse(row.quantidade_por_unidade) as QuantidadePorUnidade[],
      mediaPrecoPorUnidade: JSON.parse(row.media_preco_por_unidade) as MediaPrecoPorUnidade[],
      despesasPorCategoria: JSON.parse(row.despesas_por_categoria) as DespesaPorCategoria[],
    },
    atualizadoEm: row.atualizado_em,
  };
}
