import { getDatabase } from './database';
import type { DespesaPessoal, DespesaPessoalLocal, TipoDespesa } from '../types/despesa';

interface DespesaPessoalRow {
  id: string;
  safra_id: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  descricao: string | null;
  pendente_operacao: 'criar' | 'editar' | null;
  fila_id: string | null;
  fila_status: 'pendente' | 'sincronizado' | 'erro' | null;
  fila_erro: string | null;
}

function converterLinha(row: DespesaPessoalRow): DespesaPessoalLocal {
  return {
    id: row.id,
    tipo: row.tipo,
    valor: row.valor,
    data: row.data,
    descricao: row.descricao,
    pendenteOperacao: row.pendente_operacao,
    filaId: row.fila_id,
    erroSincronizacao: row.pendente_operacao && row.fila_status === 'erro' ? row.fila_erro : null,
  };
}

// Mesmo padrão de despesasCache.ts (mobile 04): leitura sempre com LEFT JOIN em `sync_queue`
// pra saber se um item pendente já falhou uma sincronização (docs/specs/mobile/07-despesa-pessoal.md).
export async function obterDespesasPessoaisCache(safraId: string): Promise<DespesaPessoalLocal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DespesaPessoalRow>(
    `SELECT d.*, sq.status as fila_status, sq.erro as fila_erro
     FROM despesas_pessoais_cache d
     LEFT JOIN sync_queue sq ON sq.id = d.fila_id
     WHERE d.safra_id = ?
     ORDER BY d.data DESC`,
    [safraId]
  );
  return rows.map(converterLinha);
}

export async function obterDespesaPessoalCachePorId(id: string): Promise<DespesaPessoalLocal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DespesaPessoalRow>(
    `SELECT d.*, sq.status as fila_status, sq.erro as fila_erro
     FROM despesas_pessoais_cache d
     LEFT JOIN sync_queue sq ON sq.id = d.fila_id
     WHERE d.id = ?`,
    [id]
  );
  return row ? converterLinha(row) : null;
}

// Substitui só as já confirmadas pelo servidor — preserva linhas locais ainda não
// sincronizadas (spec 00: toda tela lista o que está salvo localmente primeiro).
export async function salvarDespesasPessoaisCache(safraId: string, despesas: DespesaPessoal[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM despesas_pessoais_cache WHERE safra_id = ? AND pendente_operacao IS NULL',
      [safraId]
    );
    for (const d of despesas) {
      await db.runAsync(
        `INSERT INTO despesas_pessoais_cache (id, safra_id, tipo, valor, data, descricao, pendente_operacao, fila_id)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
        [d.id, safraId, d.tipo, d.valor, d.data, d.descricao]
      );
    }
  });
}

export async function inserirDespesaPessoalLocalPendente(safraId: string, despesa: DespesaPessoalLocal): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO despesas_pessoais_cache (id, safra_id, tipo, valor, data, descricao, pendente_operacao, fila_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [despesa.id, safraId, despesa.tipo, despesa.valor, despesa.data, despesa.descricao, despesa.pendenteOperacao, despesa.filaId]
  );
}

export async function atualizarDespesaPessoalCache(
  id: string,
  campos: Pick<DespesaPessoalLocal, 'tipo' | 'valor' | 'data' | 'descricao'> & {
    pendenteOperacao: 'criar' | 'editar' | null;
    filaId: string | null;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE despesas_pessoais_cache
     SET tipo = ?, valor = ?, data = ?, descricao = ?, pendente_operacao = ?, fila_id = ?
     WHERE id = ?`,
    [campos.tipo, campos.valor, campos.data, campos.descricao, campos.pendenteOperacao, campos.filaId, id]
  );
}

// Troca o registro otimista (id gerado no aparelho) pelo definitivo do servidor.
export async function substituirDespesaPessoalLocalPorServidor(
  safraId: string,
  idLocal: string,
  despesa: DespesaPessoal
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM despesas_pessoais_cache WHERE id = ?', [idLocal]);
    await db.runAsync(
      `INSERT INTO despesas_pessoais_cache (id, safra_id, tipo, valor, data, descricao, pendente_operacao, fila_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [despesa.id, safraId, despesa.tipo, despesa.valor, despesa.data, despesa.descricao]
    );
  });
}

export async function confirmarEdicaoDespesaPessoal(despesa: DespesaPessoal): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE despesas_pessoais_cache
     SET tipo = ?, valor = ?, data = ?, descricao = ?, pendente_operacao = NULL, fila_id = NULL
     WHERE id = ?`,
    [despesa.tipo, despesa.valor, despesa.data, despesa.descricao, despesa.id]
  );
}

export async function removerDespesaPessoalCache(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM despesas_pessoais_cache WHERE id = ?', [id]);
}
