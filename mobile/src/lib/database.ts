import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Banco único do app (expo-sqlite), aberto uma vez e reaproveitado — mesmo padrão
// recomendado pelo Expo para evitar abrir conexões repetidas (docs/specs/mobile/00-setup-e-infra.md).
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('hortiflow.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          operacao TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendente',
          tentativas INTEGER NOT NULL DEFAULT 0,
          erro TEXT,
          criado_em TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sociedades_cache (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          codigo_convite TEXT NOT NULL,
          percentual_lucro TEXT NOT NULL,
          papel TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS socios_cache (
          id TEXT PRIMARY KEY,
          sociedade_id TEXT NOT NULL,
          usuario_id TEXT,
          nome TEXT NOT NULL,
          telefone TEXT,
          percentual_lucro TEXT NOT NULL,
          papel TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS minhas_safras_cache (
          id TEXT PRIMARY KEY,
          sociedade_id TEXT NOT NULL,
          sociedade_nome TEXT NOT NULL,
          nome TEXT NOT NULL,
          observacoes TEXT,
          status TEXT NOT NULL,
          data_inicio TEXT,
          data_fim TEXT
        );

        CREATE TABLE IF NOT EXISTS safras_cache (
          id TEXT PRIMARY KEY,
          sociedade_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          observacoes TEXT,
          status TEXT NOT NULL,
          data_inicio TEXT,
          data_fim TEXT
        );

        CREATE TABLE IF NOT EXISTS despesas_cache (
          id TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          socio_id TEXT NOT NULL,
          socio_nome TEXT NOT NULL,
          tipo TEXT NOT NULL,
          valor TEXT NOT NULL,
          data TEXT NOT NULL,
          foto_comprovante TEXT,
          descricao TEXT,
          rateio TEXT,
          coberta_por_acerto INTEGER NOT NULL DEFAULT 0,
          pendente_operacao TEXT,
          fila_id TEXT
        );

        CREATE TABLE IF NOT EXISTS vendas_cache (
          id TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          data TEXT NOT NULL,
          quantidade TEXT NOT NULL,
          preco TEXT NOT NULL,
          total TEXT NOT NULL,
          comprador TEXT,
          pago INTEGER NOT NULL DEFAULT 0,
          unidade_id TEXT NOT NULL,
          unidade_nome TEXT NOT NULL,
          regras_aplicadas TEXT NOT NULL,
          coberta_por_acerto INTEGER NOT NULL DEFAULT 0,
          pendente_operacao TEXT,
          fila_id TEXT
        );

        CREATE TABLE IF NOT EXISTS unidades_venda_cache (
          id TEXT PRIMARY KEY,
          sociedade_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          ativo INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS regras_recorrentes_cache (
          id TEXT PRIMARY KEY,
          sociedade_id TEXT NOT NULL,
          socio_id TEXT NOT NULL,
          socio_nome TEXT NOT NULL,
          tipo_gatilho TEXT NOT NULL,
          tipo_despesa TEXT NOT NULL,
          valor TEXT NOT NULL,
          unidade_id TEXT,
          unidade_nome TEXT,
          ativo INTEGER NOT NULL DEFAULT 1,
          criado_por TEXT NOT NULL,
          rateio TEXT
        );

        CREATE TABLE IF NOT EXISTS sugestoes_cache (
          id TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          socio_id TEXT NOT NULL,
          socio_nome TEXT NOT NULL,
          tipo_despesa TEXT NOT NULL,
          valor TEXT NOT NULL,
          confirmada_localmente INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS simulacao_cache (
          chave TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          data_inicio TEXT,
          data_fim TEXT,
          receita TEXT NOT NULL,
          despesas TEXT NOT NULL,
          lucro_liquido TEXT NOT NULL,
          divisao TEXT NOT NULL,
          atualizado_em TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS acertos_cache (
          id TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          data_inicio TEXT NOT NULL,
          data_fim TEXT NOT NULL,
          tipo TEXT NOT NULL,
          criado_em TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS acertos_cache_meta (
          safra_id TEXT PRIMARY KEY,
          atualizado_em TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS acerto_detalhe_cache (
          id TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          data_inicio TEXT NOT NULL,
          data_fim TEXT NOT NULL,
          tipo TEXT NOT NULL,
          criado_em TEXT NOT NULL,
          receita TEXT NOT NULL,
          despesas TEXT NOT NULL,
          lucro_liquido TEXT NOT NULL,
          socios TEXT NOT NULL,
          atualizado_em TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}
