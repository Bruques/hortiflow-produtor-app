import { getDatabase } from './database';
import type { AcertoDetalhado, AcertoResumo, AcertoSocioDetalhe, TipoAcerto } from '../types/acerto';

interface AcertoResumoRow {
  id: string;
  data_inicio: string;
  data_fim: string;
  tipo: TipoAcerto;
  criado_em: string;
}

interface AcertoDetalheRow {
  id: string;
  safra_id: string;
  data_inicio: string;
  data_fim: string;
  tipo: TipoAcerto;
  criado_em: string;
  receita: string;
  despesas: string;
  lucro_liquido: string;
  socios: string;
  atualizado_em: string;
}

export interface AcertosCacheados {
  acertos: AcertoResumo[];
  atualizadoEm: string | null;
}

// "Substitui tudo" a cada fetch bem-sucedido, mesmo padrão de safrasCache.ts/sociedadesCache.ts.
// O timestamp mora numa tabela separada (`acertos_cache_meta`), não numa coluna da própria
// linha: uma safra sem nenhum acerto ainda (estado comum, recém aberta) teria zero linhas em
// `acertos_cache` e perderia o "atualizado às" se ele dependesse de alguma linha existir.
export async function salvarAcertosCache(safraId: string, acertos: AcertoResumo[]): Promise<string> {
  const db = await getDatabase();
  const atualizadoEm = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM acertos_cache WHERE safra_id = ?', [safraId]);
    for (const a of acertos) {
      await db.runAsync(
        'INSERT INTO acertos_cache (id, safra_id, data_inicio, data_fim, tipo, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
        [a.id, safraId, a.data_inicio, a.data_fim, a.tipo, a.criado_em]
      );
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO acertos_cache_meta (safra_id, atualizado_em) VALUES (?, ?)',
      [safraId, atualizadoEm]
    );
  });
  return atualizadoEm;
}

export async function obterAcertosCache(safraId: string): Promise<AcertosCacheados> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AcertoResumoRow>(
    'SELECT * FROM acertos_cache WHERE safra_id = ? ORDER BY data_fim DESC',
    [safraId]
  );
  const meta = await db.getAllAsync<{ atualizado_em: string }>(
    'SELECT atualizado_em FROM acertos_cache_meta WHERE safra_id = ?',
    [safraId]
  );
  return {
    acertos: rows.map(({ id, data_inicio, data_fim, tipo, criado_em }) => ({ id, data_inicio, data_fim, tipo, criado_em })),
    atualizadoEm: meta[0]?.atualizado_em ?? null,
  };
}

export async function salvarAcertoDetalheCache(acerto: AcertoDetalhado): Promise<string> {
  const db = await getDatabase();
  const atualizadoEm = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO acerto_detalhe_cache
      (id, safra_id, data_inicio, data_fim, tipo, criado_em, receita, despesas, lucro_liquido, socios, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      acerto.id,
      acerto.safra_id,
      acerto.data_inicio,
      acerto.data_fim,
      acerto.tipo,
      acerto.criado_em,
      String(acerto.receita),
      String(acerto.despesas),
      String(acerto.lucroLiquido),
      JSON.stringify(acerto.socios),
      atualizadoEm,
    ]
  );
  return atualizadoEm;
}

export async function obterAcertoDetalheCache(
  acertoId: string
): Promise<{ acerto: AcertoDetalhado; atualizadoEm: string } | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AcertoDetalheRow>('SELECT * FROM acerto_detalhe_cache WHERE id = ?', [acertoId]);
  const row = rows[0];
  if (!row) return null;
  return {
    acerto: {
      id: row.id,
      safra_id: row.safra_id,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      tipo: row.tipo,
      criado_em: row.criado_em,
      receita: Number(row.receita),
      despesas: Number(row.despesas),
      lucroLiquido: Number(row.lucro_liquido),
      socios: JSON.parse(row.socios) as AcertoSocioDetalhe[],
    },
    atualizadoEm: row.atualizado_em,
  };
}
