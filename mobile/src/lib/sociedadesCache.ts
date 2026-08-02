import { getDatabase } from './database';
import type { PapelSocio, Sociedade, Socio } from '../types/sociedade';

interface SociedadeRow {
  id: string;
  nome: string;
  codigo_convite: string;
  percentual_lucro: string;
  papel: PapelSocio;
}

interface SocioRow {
  id: string;
  sociedade_id: string;
  usuario_id: string | null;
  nome: string;
  telefone: string | null;
  percentual_lucro: string;
  papel: PapelSocio;
}

// Cache local (leitura) de sociedades/sócios já buscados da API — a tela mostra isso primeiro
// e atualiza quando a resposta de rede chega, nunca ficando em branco por falta de internet
// (docs/specs/mobile/00-setup-e-infra.md, docs/specs/mobile/02-sociedade-e-socios.md).
// Estratégia "substitui tudo" (apaga e reinsere a lista inteira): mais simples que diff
// linha a linha, e adequado ao volume baixo dessas listas (poucas sociedades/sócios por conta).
export async function salvarSociedadesCache(sociedades: Sociedade[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sociedades_cache');
    for (const s of sociedades) {
      await db.runAsync(
        'INSERT INTO sociedades_cache (id, nome, codigo_convite, percentual_lucro, papel) VALUES (?, ?, ?, ?, ?)',
        [s.id, s.nome, s.codigo_convite, s.percentual_lucro, s.papel]
      );
    }
  });
}

export async function obterSociedadesCache(): Promise<Sociedade[]> {
  const db = await getDatabase();
  return db.getAllAsync<SociedadeRow>('SELECT * FROM sociedades_cache');
}

export async function salvarSociosCache(sociedadeId: string, socios: Socio[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM socios_cache WHERE sociedade_id = ?', [sociedadeId]);
    for (const s of socios) {
      await db.runAsync(
        'INSERT INTO socios_cache (id, sociedade_id, usuario_id, nome, telefone, percentual_lucro, papel) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, sociedadeId, s.usuario_id, s.nome, s.telefone, s.percentual_lucro, s.papel]
      );
    }
  });
}

export async function obterSociosCache(sociedadeId: string): Promise<Socio[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SocioRow>('SELECT * FROM socios_cache WHERE sociedade_id = ?', [sociedadeId]);
  return rows.map(({ sociedade_id: _sociedadeId, ...socio }) => socio);
}
