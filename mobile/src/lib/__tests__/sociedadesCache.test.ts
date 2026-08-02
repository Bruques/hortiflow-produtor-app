import {
  salvarSociedadesCache,
  obterSociedadesCache,
  salvarSociosCache,
  obterSociosCache,
} from '../sociedadesCache';
import type { Sociedade, Socio } from '../../types/sociedade';

// Fake mínimo do banco em memória, mesmo padrão de src/lib/__tests__/syncQueue.test.ts —
// evita depender do módulo nativo expo-sqlite dentro do Jest.
let mockSociedades: Record<string, unknown>[] = [];
let mockSocios: Record<string, unknown>[] = [];

jest.mock('../database', () => ({
  getDatabase: async () => ({
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
    runAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('DELETE FROM sociedades_cache')) {
        mockSociedades = [];
      } else if (sql.startsWith('INSERT INTO sociedades_cache')) {
        const [id, nome, codigo_convite, percentual_lucro, papel] = params;
        mockSociedades.push({ id, nome, codigo_convite, percentual_lucro, papel });
      } else if (sql.startsWith('DELETE FROM socios_cache')) {
        const [sociedadeId] = params;
        mockSocios = mockSocios.filter((s) => s.sociedade_id !== sociedadeId);
      } else if (sql.startsWith('INSERT INTO socios_cache')) {
        const [id, sociedade_id, usuario_id, nome, telefone, percentual_lucro, papel] = params;
        mockSocios.push({ id, sociedade_id, usuario_id, nome, telefone, percentual_lucro, papel });
      }
    },
    getAllAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM sociedades_cache')) return mockSociedades;
      const [sociedadeId] = params;
      return mockSocios.filter((s) => s.sociedade_id === sociedadeId);
    },
  }),
}));

beforeEach(() => {
  mockSociedades = [];
  mockSocios = [];
});

const sociedade: Sociedade = {
  id: 'soc-1',
  nome: 'Sítio Boa Vista',
  codigo_convite: '482913',
  percentual_lucro: '100.00',
  papel: 'FINANCIADOR',
};

const socio: Socio = {
  id: 'sc-1',
  usuario_id: 'u-1',
  nome: 'Eduardo Ramos',
  telefone: '35997302015',
  percentual_lucro: '60.00',
  papel: 'FINANCIADOR',
};

describe('sociedadesCache', () => {
  it('salva e devolve as sociedades cacheadas', async () => {
    await salvarSociedadesCache([sociedade]);
    expect(await obterSociedadesCache()).toEqual([sociedade]);
  });

  it('substitui a lista inteira a cada save (não acumula sociedade removida no servidor)', async () => {
    await salvarSociedadesCache([sociedade]);
    await salvarSociedadesCache([{ ...sociedade, id: 'soc-2', nome: 'Outra' }]);
    const salvas = await obterSociedadesCache();
    expect(salvas).toHaveLength(1);
    expect(salvas[0].id).toBe('soc-2');
  });

  it('salva e devolve os sócios cacheados de uma sociedade', async () => {
    await salvarSociosCache('soc-1', [socio]);
    expect(await obterSociosCache('soc-1')).toEqual([socio]);
  });

  it('não mistura sócios de sociedades diferentes', async () => {
    await salvarSociosCache('soc-1', [socio]);
    await salvarSociosCache('soc-2', [{ ...socio, id: 'sc-2' }]);
    expect(await obterSociosCache('soc-1')).toEqual([socio]);
    expect(await obterSociosCache('soc-2')).toEqual([{ ...socio, id: 'sc-2' }]);
  });
});
