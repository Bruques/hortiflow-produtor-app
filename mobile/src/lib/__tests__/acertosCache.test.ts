import {
  obterAcertoDetalheCache,
  obterAcertosCache,
  salvarAcertoDetalheCache,
  salvarAcertosCache,
} from '../acertosCache';
import type { AcertoDetalhado, AcertoResumo } from '../../types/acerto';

// Fake mínimo do banco em memória, mesmo padrão de safrasCache.test.ts.
let mockAcertos: Record<string, unknown>[] = [];
let mockMeta: Record<string, unknown>[] = [];
let mockDetalhe: Record<string, unknown>[] = [];

jest.mock('../database', () => ({
  getDatabase: async () => ({
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
    runAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('DELETE FROM acertos_cache')) {
        const [safraId] = params;
        mockAcertos = mockAcertos.filter((a) => a.safra_id !== safraId);
      } else if (sql.startsWith('INSERT INTO acertos_cache')) {
        const [id, safra_id, data_inicio, data_fim, tipo, criado_em] = params;
        mockAcertos.push({ id, safra_id, data_inicio, data_fim, tipo, criado_em });
      } else if (sql.startsWith('INSERT OR REPLACE INTO acertos_cache_meta')) {
        const [safra_id, atualizado_em] = params;
        mockMeta = mockMeta.filter((m) => m.safra_id !== safra_id);
        mockMeta.push({ safra_id, atualizado_em });
      } else if (sql.startsWith('INSERT OR REPLACE INTO acerto_detalhe_cache')) {
        const [id, safra_id, data_inicio, data_fim, tipo, criado_em, receita, despesas, lucro_liquido, socios, atualizado_em] =
          params;
        mockDetalhe = mockDetalhe.filter((d) => d.id !== id);
        mockDetalhe.push({
          id,
          safra_id,
          data_inicio,
          data_fim,
          tipo,
          criado_em,
          receita,
          despesas,
          lucro_liquido,
          socios,
          atualizado_em,
        });
      }
    },
    getAllAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM acertos_cache_meta')) {
        const [safraId] = params;
        return mockMeta.filter((m) => m.safra_id === safraId);
      }
      if (sql.includes('FROM acertos_cache')) {
        const [safraId] = params;
        return mockAcertos.filter((a) => a.safra_id === safraId);
      }
      if (sql.includes('FROM acerto_detalhe_cache')) {
        const [id] = params;
        return mockDetalhe.filter((d) => d.id === id);
      }
      return [];
    },
  }),
}));

beforeEach(() => {
  mockAcertos = [];
  mockMeta = [];
  mockDetalhe = [];
});

const acerto: AcertoResumo = {
  id: 'ac-1',
  data_inicio: '2026-07-01',
  data_fim: '2026-07-31',
  tipo: 'PARCIAL',
  criado_em: '2026-08-01T12:00:00.000Z',
};

const detalhado: AcertoDetalhado = {
  ...acerto,
  safra_id: 'sf-1',
  receita: 1000,
  despesas: 400,
  lucroLiquido: 600,
  socios: [{ socio_id: 'sc-1', nome: 'Eduardo', despesas_bancadas: 400, percentual_aplicado: 60, valor_lucro: 360 }],
};

describe('acertosCache — histórico', () => {
  it('sem nada salvo, não há timestamp nem acertos', async () => {
    const cache = await obterAcertosCache('sf-1');
    expect(cache).toEqual({ acertos: [], atualizadoEm: null });
  });

  it('salva e devolve os acertos cacheados de uma safra', async () => {
    await salvarAcertosCache('sf-1', [acerto]);
    const cache = await obterAcertosCache('sf-1');
    expect(cache.acertos).toEqual([acerto]);
    expect(cache.atualizadoEm).toEqual(expect.any(String));
  });

  it('guarda o timestamp mesmo quando a safra não tem nenhum acerto ainda', async () => {
    await salvarAcertosCache('sf-1', []);
    const cache = await obterAcertosCache('sf-1');
    expect(cache.acertos).toEqual([]);
    expect(cache.atualizadoEm).toEqual(expect.any(String));
  });

  it('não mistura acertos de safras diferentes', async () => {
    await salvarAcertosCache('sf-1', [acerto]);
    await salvarAcertosCache('sf-2', [{ ...acerto, id: 'ac-2' }]);
    expect((await obterAcertosCache('sf-1')).acertos).toEqual([acerto]);
    expect((await obterAcertosCache('sf-2')).acertos).toEqual([{ ...acerto, id: 'ac-2' }]);
  });

  it('substitui a lista inteira a cada save', async () => {
    await salvarAcertosCache('sf-1', [acerto]);
    await salvarAcertosCache('sf-1', [{ ...acerto, id: 'ac-2' }]);
    const cache = await obterAcertosCache('sf-1');
    expect(cache.acertos).toHaveLength(1);
    expect(cache.acertos[0].id).toBe('ac-2');
  });
});

describe('acertosCache — extrato de um acerto', () => {
  it('sem nada salvo, devolve null', async () => {
    expect(await obterAcertoDetalheCache('ac-1')).toBeNull();
  });

  it('salva e devolve o extrato completo', async () => {
    await salvarAcertoDetalheCache(detalhado);
    const cache = await obterAcertoDetalheCache('ac-1');
    expect(cache?.acerto).toEqual(detalhado);
    expect(cache?.atualizadoEm).toEqual(expect.any(String));
  });
});
