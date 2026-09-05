import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Banco único do app (expo-sqlite), aberto uma vez e reaproveitado — mesmo padrão
// recomendado pelo Expo para evitar abrir conexões repetidas (docs/specs/mobile/00-setup-e-infra.md).
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('hortiflow.db').then(async (db) => {
      // Migração pra quem já tinha o app instalado antes da task 23 (sócios por safra):
      // `socios_cache` tinha `id` como chave primária sozinha, correto enquanto um sócio só
      // podia pertencer a uma sociedade — agora que o mesmo sócio participa de várias safras,
      // a segunda safra cacheada colidia com a chave primária da primeira (INSERT falhava
      // silenciosamente, deixando a lista de sócios vazia pra quem estivesse em 2+ safras;
      // bug relatado 2026-09-05). `CREATE TABLE IF NOT EXISTS` não muda a chave primária de
      // uma tabela já existente, então detecta o schema antigo e recria — é só cache, sem
      // perda de dado real (repovoa sozinho na próxima sincronização).
      const schemaAntigo = await db.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'socios_cache'"
      );
      if (schemaAntigo && !schemaAntigo.sql.includes('PRIMARY KEY (sociedade_id, id)')) {
        await db.execAsync('DROP TABLE IF EXISTS socios_cache');
      }

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
          id TEXT NOT NULL,
          sociedade_id TEXT NOT NULL,
          usuario_id TEXT,
          nome TEXT NOT NULL,
          telefone TEXT,
          percentual_lucro TEXT NOT NULL,
          papel TEXT NOT NULL,
          PRIMARY KEY (sociedade_id, id)
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
          fila_id TEXT,
          status_pagamento TEXT NOT NULL DEFAULT 'PAGO',
          data_vencimento TEXT,
          data_pagamento TEXT
        );

        CREATE TABLE IF NOT EXISTS despesas_pessoais_cache (
          id TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          tipo TEXT NOT NULL,
          valor TEXT NOT NULL,
          data TEXT NOT NULL,
          descricao TEXT,
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

        CREATE TABLE IF NOT EXISTS relatorio_completo_cache (
          chave TEXT PRIMARY KEY,
          safra_id TEXT NOT NULL,
          data_inicio TEXT,
          data_fim TEXT,
          receita TEXT NOT NULL,
          despesas TEXT NOT NULL,
          lucro_liquido TEXT NOT NULL,
          divisao TEXT NOT NULL,
          quantidade_por_unidade TEXT NOT NULL,
          media_preco_por_unidade TEXT NOT NULL,
          despesas_por_categoria TEXT NOT NULL,
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

      // Migração pra quem já tinha o app instalado antes da spec 19 (despesa pendente de
      // pagamento e parcelamento): `CREATE TABLE IF NOT EXISTS` acima não adiciona coluna em
      // tabela já existente, então o `despesas_cache` de um aparelho antigo não tem essas 3
      // colunas ainda. SQLite não suporta "ADD COLUMN IF NOT EXISTS" — cada ALTER roda isolado
      // e ignora o erro de "coluna já existe" (instalação nova, onde o CREATE TABLE acima já
      // criou tudo de uma vez).
      for (const alter of [
        "ALTER TABLE despesas_cache ADD COLUMN status_pagamento TEXT NOT NULL DEFAULT 'PAGO'",
        'ALTER TABLE despesas_cache ADD COLUMN data_vencimento TEXT',
        'ALTER TABLE despesas_cache ADD COLUMN data_pagamento TEXT',
      ]) {
        try {
          await db.execAsync(alter);
        } catch {
          // coluna já existe — instalação nova ou migração já rodou antes.
        }
      }

      return db;
    });
  }
  return dbPromise;
}
