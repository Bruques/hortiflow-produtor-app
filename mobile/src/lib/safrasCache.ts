import { getDatabase } from './database';
import type { MinhaSafra, Safra, StatusSafra } from '../types/safra';

interface MinhaSafraRow {
  id: string;
  sociedade_id: string;
  sociedade_nome: string;
  nome: string;
  observacoes: string | null;
  status: StatusSafra;
  data_inicio: string | null;
  data_fim: string | null;
}

interface SafraRow {
  id: string;
  sociedade_id: string;
  nome: string;
  observacoes: string | null;
  status: StatusSafra;
  data_inicio: string | null;
  data_fim: string | null;
}

// Cache local (leitura) de safras — mesmo padrão e mesma justificativa de
// src/lib/sociedadesCache.ts (docs/specs/mobile/00-setup-e-infra.md,
// docs/specs/mobile/03-safra.md): "substitui tudo" a cada fetch bem-sucedido.
export async function salvarMinhasSafrasCache(safras: MinhaSafra[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM minhas_safras_cache');
    for (const s of safras) {
      await db.runAsync(
        'INSERT INTO minhas_safras_cache (id, sociedade_id, sociedade_nome, nome, observacoes, status, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.sociedade_id, s.sociedade_nome, s.nome, s.observacoes, s.status, s.data_inicio, s.data_fim]
      );
    }
  });
}

export async function obterMinhasSafrasCache(): Promise<MinhaSafra[]> {
  const db = await getDatabase();
  return db.getAllAsync<MinhaSafraRow>('SELECT * FROM minhas_safras_cache');
}

export async function salvarSafrasCache(sociedadeId: string, safras: Safra[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM safras_cache WHERE sociedade_id = ?', [sociedadeId]);
    for (const s of safras) {
      await db.runAsync(
        'INSERT INTO safras_cache (id, sociedade_id, nome, observacoes, status, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, sociedadeId, s.nome, s.observacoes, s.status, s.data_inicio, s.data_fim]
      );
    }
  });
}

export async function obterSafrasCache(sociedadeId: string): Promise<Safra[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SafraRow>('SELECT * FROM safras_cache WHERE sociedade_id = ?', [sociedadeId]);
  return rows;
}
