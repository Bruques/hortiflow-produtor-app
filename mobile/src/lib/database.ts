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
      `);
      return db;
    });
  }
  return dbPromise;
}
