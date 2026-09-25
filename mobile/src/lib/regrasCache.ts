import { getDatabase } from './database';
import type { ItemRateio, TipoDespesa } from '../types/despesa';
import type { RegraDespesaRecorrente, TipoGatilhoRegra } from '../types/regraDespesaRecorrente';

interface RegraRow {
  id: string;
  sociedade_id: string;
  socio_id: string;
  socio_nome: string;
  tipo_gatilho: TipoGatilhoRegra;
  tipo_despesa: TipoDespesa;
  valor: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  ativo: number;
  criado_por: string;
  rateio: string | null;
  safra_id: string | null;
}

function converterLinha(row: RegraRow): RegraDespesaRecorrente {
  return {
    id: row.id,
    socio_id: row.socio_id,
    socio_nome: row.socio_nome,
    tipo_gatilho: row.tipo_gatilho,
    tipo_despesa: row.tipo_despesa,
    valor: row.valor,
    unidade_id: row.unidade_id,
    unidade_nome: row.unidade_nome,
    safra_id: row.safra_id,
    ativo: row.ativo === 1,
    criado_por: row.criado_por,
    rateio: row.rateio ? (JSON.parse(row.rateio) as ItemRateio[]) : null,
  };
}

// Cache de leitura das regras de despesa recorrente — mesma estratégia "substitui tudo" de
// unidadesVendaCache.ts: criar/editar regra exige conexão e nunca passa pela fila offline
// (docs/specs/mobile/06-vendas-e-despesa-recorrente.md); este cache serve só pra montar os
// toggles de regra `POR_VENDA` ao lançar uma Venda sem internet.
//
// Spec 30 — o cache é por lavoura: "substitui tudo" vale só pro que aquela lavoura enxerga
// (regras dela + globais, `safra_id` nulo). Regras de OUTRAS lavouras ficam intactas, senão abrir
// a lavoura B apagaria o cache da A.
export async function salvarRegrasCache(
  sociedadeId: string,
  safraId: string,
  regras: RegraDespesaRecorrente[]
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM regras_recorrentes_cache WHERE sociedade_id = ? AND (safra_id = ? OR safra_id IS NULL)',
      [sociedadeId, safraId]
    );
    for (const r of regras) {
      await db.runAsync(
        `INSERT INTO regras_recorrentes_cache
          (id, sociedade_id, socio_id, socio_nome, tipo_gatilho, tipo_despesa, valor, unidade_id, unidade_nome, ativo, criado_por, rateio, safra_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          sociedadeId,
          r.socio_id,
          r.socio_nome,
          r.tipo_gatilho,
          r.tipo_despesa,
          r.valor,
          r.unidade_id,
          r.unidade_nome,
          r.ativo ? 1 : 0,
          r.criado_por,
          r.rateio ? JSON.stringify(r.rateio) : null,
          r.safra_id,
        ]
      );
    }
  });
}

export async function obterRegrasCache(sociedadeId: string, safraId: string): Promise<RegraDespesaRecorrente[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RegraRow>(
    'SELECT * FROM regras_recorrentes_cache WHERE sociedade_id = ? AND (safra_id = ? OR safra_id IS NULL)',
    [sociedadeId, safraId]
  );
  return rows.map(converterLinha);
}
