import { getDatabase } from './database';
import type { UnidadeVenda } from '../types/unidadeVenda';

interface UnidadeVendaRow {
  id: string;
  sociedade_id: string;
  nome: string;
  ativo: number;
}

function converterLinha(row: UnidadeVendaRow): UnidadeVenda {
  return { id: row.id, sociedade_id: row.sociedade_id, nome: row.nome, ativo: row.ativo === 1 };
}

// Cache de leitura das unidades de venda — mesma estratégia "substitui tudo" de
// sociedadesCache.ts: cadastrar/desativar unidade exige conexão e nunca passa pela fila
// offline (docs/specs/mobile/06-vendas-e-despesa-recorrente.md), então este cache serve só
// pra montar o seletor de unidade ao lançar uma Venda sem internet.
export async function salvarUnidadesVendaCache(sociedadeId: string, unidades: UnidadeVenda[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM unidades_venda_cache WHERE sociedade_id = ?', [sociedadeId]);
    for (const u of unidades) {
      await db.runAsync('INSERT INTO unidades_venda_cache (id, sociedade_id, nome, ativo) VALUES (?, ?, ?, ?)', [
        u.id,
        sociedadeId,
        u.nome,
        u.ativo ? 1 : 0,
      ]);
    }
  });
}

export async function obterUnidadesVendaCache(sociedadeId: string): Promise<UnidadeVenda[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<UnidadeVendaRow>('SELECT * FROM unidades_venda_cache WHERE sociedade_id = ?', [
    sociedadeId,
  ]);
  return rows.map(converterLinha);
}
