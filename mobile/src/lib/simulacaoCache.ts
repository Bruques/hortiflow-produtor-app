import { getDatabase } from './database';
import type { DivisaoSocio, PeriodoFiltro, Simulacao } from '../types/simulacao';

export type FiltroSimulacao = { periodo: PeriodoFiltro } | { dataInicio: string; dataFim: string };

interface SimulacaoCacheRow {
  data_inicio: string | null;
  data_fim: string | null;
  receita: string;
  despesas: string;
  lucro_liquido: string;
  divisao: string;
  atualizado_em: string;
}

export interface SimulacaoCacheada {
  simulacao: Simulacao;
  atualizadoEm: string;
}

// Uma linha por combinação de safra+filtro (não só por safra), pra distinguir "esse período
// nunca foi carregado" de "esse período foi carregado e deu zero" — critério de aceite 4 da
// docs/specs/mobile/05-painel-e-acerto.md.
function chave(safraId: string, filtro: FiltroSimulacao): string {
  if ('periodo' in filtro) return `${safraId}:periodo:${filtro.periodo}`;
  return `${safraId}:custom:${filtro.dataInicio}:${filtro.dataFim}`;
}

export async function salvarSimulacaoCache(
  safraId: string,
  filtro: FiltroSimulacao,
  simulacao: Simulacao
): Promise<string> {
  const db = await getDatabase();
  const atualizadoEm = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO simulacao_cache
      (chave, safra_id, data_inicio, data_fim, receita, despesas, lucro_liquido, divisao, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chave(safraId, filtro),
      safraId,
      simulacao.periodo.data_inicio,
      simulacao.periodo.data_fim,
      String(simulacao.receita),
      String(simulacao.despesas),
      String(simulacao.lucroLiquido),
      JSON.stringify(simulacao.divisao),
      atualizadoEm,
    ]
  );
  return atualizadoEm;
}

export async function obterSimulacaoCache(
  safraId: string,
  filtro: FiltroSimulacao
): Promise<SimulacaoCacheada | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SimulacaoCacheRow>('SELECT * FROM simulacao_cache WHERE chave = ?', [
    chave(safraId, filtro),
  ]);
  const row = rows[0];
  if (!row) return null;
  return {
    simulacao: {
      periodo: { data_inicio: row.data_inicio, data_fim: row.data_fim },
      receita: Number(row.receita),
      despesas: Number(row.despesas),
      lucroLiquido: Number(row.lucro_liquido),
      divisao: JSON.parse(row.divisao) as DivisaoSocio[],
    },
    atualizadoEm: row.atualizado_em,
  };
}
