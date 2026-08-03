import { getDatabase } from './database';
import type { TipoDespesa } from '../types/despesa';
import type { SugestaoDespesaRecorrente } from '../types/regraDespesaRecorrente';

interface SugestaoRow {
  id: string;
  safra_id: string;
  socio_id: string;
  socio_nome: string;
  tipo_despesa: TipoDespesa;
  valor: string;
  confirmada_localmente: number;
}

function converterLinha(row: SugestaoRow): SugestaoDespesaRecorrente {
  return {
    id: row.id,
    socio_id: row.socio_id,
    socio_nome: row.socio_nome,
    tipo_despesa: row.tipo_despesa,
    valor: row.valor,
  };
}

// Cache de leitura das sugestões do dia (regras `POR_PERIODO` pendentes de confirmação) —
// "substitui tudo" como os demais caches de leitura. `confirmada_localmente` é o que faz uma
// sugestão sumir da lista assim que o sócio confirma, mesmo offline (antes de qualquer
// resposta do servidor) — docs/specs/mobile/06-vendas-e-despesa-recorrente.md.
export async function salvarSugestoesCache(safraId: string, sugestoes: SugestaoDespesaRecorrente[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sugestoes_cache WHERE safra_id = ?', [safraId]);
    for (const s of sugestoes) {
      await db.runAsync(
        `INSERT INTO sugestoes_cache (id, safra_id, socio_id, socio_nome, tipo_despesa, valor, confirmada_localmente)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [s.id, safraId, s.socio_id, s.socio_nome, s.tipo_despesa, s.valor]
      );
    }
  });
}

export async function obterSugestoesCache(safraId: string): Promise<SugestaoDespesaRecorrente[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SugestaoRow>(
    'SELECT * FROM sugestoes_cache WHERE safra_id = ? AND confirmada_localmente = 0',
    [safraId]
  );
  return rows.map(converterLinha);
}

export async function marcarSugestaoConfirmadaLocalmente(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sugestoes_cache SET confirmada_localmente = 1 WHERE id = ?', [id]);
}
