import {
  salvarMinhasSafrasCache,
  obterMinhasSafrasCache,
  salvarSafrasCache,
  obterSafrasCache,
} from '../safrasCache';
import type { MinhaSafra, Safra } from '../../types/safra';

// Fake mínimo do banco em memória, mesmo padrão de sociedadesCache.test.ts.
let mockMinhasSafras: Record<string, unknown>[] = [];
let mockSafras: Record<string, unknown>[] = [];

jest.mock('../database', () => ({
  getDatabase: async () => ({
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
    runAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('DELETE FROM minhas_safras_cache')) {
        mockMinhasSafras = [];
      } else if (sql.startsWith('INSERT INTO minhas_safras_cache')) {
        const [id, sociedade_id, sociedade_nome, nome, observacoes, status, data_inicio, data_fim] = params;
        mockMinhasSafras.push({ id, sociedade_id, sociedade_nome, nome, observacoes, status, data_inicio, data_fim });
      } else if (sql.startsWith('DELETE FROM safras_cache')) {
        const [sociedadeId] = params;
        mockSafras = mockSafras.filter((s) => s.sociedade_id !== sociedadeId);
      } else if (sql.startsWith('INSERT INTO safras_cache')) {
        const [id, sociedade_id, nome, observacoes, status, data_inicio, data_fim] = params;
        mockSafras.push({ id, sociedade_id, nome, observacoes, status, data_inicio, data_fim });
      }
    },
    getAllAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM minhas_safras_cache')) return mockMinhasSafras;
      const [sociedadeId] = params;
      return mockSafras.filter((s) => s.sociedade_id === sociedadeId);
    },
  }),
}));

beforeEach(() => {
  mockMinhasSafras = [];
  mockSafras = [];
});

const minhaSafra: MinhaSafra = {
  id: 'sf-1',
  sociedade_id: 'soc-1',
  sociedade_nome: 'Sítio Boa Vista',
  nome: 'Safra 2026',
  observacoes: null,
  status: 'EM_ANDAMENTO',
  data_inicio: '2026-01-10',
  data_fim: null,
};

const safra: Safra = {
  id: 'sf-1',
  sociedade_id: 'soc-1',
  nome: 'Safra 2026',
  observacoes: null,
  status: 'EM_ANDAMENTO',
  data_inicio: '2026-01-10',
  data_fim: null,
};

describe('safrasCache', () => {
  it('salva e devolve "minhas safras" cacheadas', async () => {
    await salvarMinhasSafrasCache([minhaSafra]);
    expect(await obterMinhasSafrasCache()).toEqual([minhaSafra]);
  });

  it('substitui a lista inteira de "minhas safras" a cada save', async () => {
    await salvarMinhasSafrasCache([minhaSafra]);
    await salvarMinhasSafrasCache([{ ...minhaSafra, id: 'sf-2', nome: 'Outra safra' }]);
    const salvas = await obterMinhasSafrasCache();
    expect(salvas).toHaveLength(1);
    expect(salvas[0].id).toBe('sf-2');
  });

  it('salva e devolve as safras cacheadas de uma sociedade', async () => {
    await salvarSafrasCache('soc-1', [safra]);
    expect(await obterSafrasCache('soc-1')).toEqual([safra]);
  });

  it('não mistura safras de sociedades diferentes', async () => {
    await salvarSafrasCache('soc-1', [safra]);
    await salvarSafrasCache('soc-2', [{ ...safra, id: 'sf-2', sociedade_id: 'soc-2' }]);
    expect(await obterSafrasCache('soc-1')).toEqual([safra]);
    expect(await obterSafrasCache('soc-2')).toEqual([{ ...safra, id: 'sf-2', sociedade_id: 'soc-2' }]);
  });
});
