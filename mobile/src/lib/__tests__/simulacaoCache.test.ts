import { obterSimulacaoCache, salvarSimulacaoCache } from '../simulacaoCache';
import type { Simulacao } from '../../types/simulacao';

// Fake mínimo do banco em memória, mesmo padrão de safrasCache.test.ts/sociedadesCache.test.ts.
let mockLinhas: Record<string, unknown>[] = [];

jest.mock('../database', () => ({
  getDatabase: async () => ({
    runAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('INSERT OR REPLACE INTO simulacao_cache')) {
        const [chave, safra_id, data_inicio, data_fim, receita, despesas, lucro_liquido, divisao, atualizado_em] =
          params;
        mockLinhas = mockLinhas.filter((l) => l.chave !== chave);
        mockLinhas.push({ chave, safra_id, data_inicio, data_fim, receita, despesas, lucro_liquido, divisao, atualizado_em });
      }
    },
    getAllAsync: async (sql: string, params: unknown[] = []) => {
      const [chave] = params;
      return mockLinhas.filter((l) => l.chave === chave);
    },
  }),
}));

beforeEach(() => {
  mockLinhas = [];
});

const simulacao: Simulacao = {
  periodo: { data_inicio: '2026-08-01', data_fim: '2026-08-01' },
  receita: 1000,
  despesas: 400,
  lucroLiquido: 600,
  divisao: [{ socio_id: 'sc-1', nome: 'Eduardo', percentual: 60, valor: 360 }],
};

describe('simulacaoCache', () => {
  it('não há nada salvo pra um filtro nunca carregado', async () => {
    expect(await obterSimulacaoCache('sf-1', { periodo: 'dia' })).toBeNull();
  });

  it('salva e devolve a simulação de um período fixo', async () => {
    await salvarSimulacaoCache('sf-1', { periodo: 'dia' }, simulacao);
    const cache = await obterSimulacaoCache('sf-1', { periodo: 'dia' });
    expect(cache?.simulacao).toEqual(simulacao);
    expect(cache?.atualizadoEm).toEqual(expect.any(String));
  });

  it('não mistura o cache de períodos diferentes da mesma safra', async () => {
    await salvarSimulacaoCache('sf-1', { periodo: 'dia' }, simulacao);
    expect(await obterSimulacaoCache('sf-1', { periodo: 'semana' })).toBeNull();
  });

  it('cacheia um intervalo personalizado separado do período fixo', async () => {
    const personalizada = { ...simulacao, lucroLiquido: 900 };
    await salvarSimulacaoCache('sf-1', { periodo: 'dia' }, simulacao);
    await salvarSimulacaoCache('sf-1', { dataInicio: '2026-07-01', dataFim: '2026-07-31' }, personalizada);

    expect((await obterSimulacaoCache('sf-1', { periodo: 'dia' }))?.simulacao).toEqual(simulacao);
    expect(
      (await obterSimulacaoCache('sf-1', { dataInicio: '2026-07-01', dataFim: '2026-07-31' }))?.simulacao
    ).toEqual(personalizada);
  });

  it('substitui o cache do mesmo filtro numa nova busca', async () => {
    await salvarSimulacaoCache('sf-1', { periodo: 'dia' }, simulacao);
    const atualizada = { ...simulacao, lucroLiquido: 700 };
    await salvarSimulacaoCache('sf-1', { periodo: 'dia' }, atualizada);
    expect((await obterSimulacaoCache('sf-1', { periodo: 'dia' }))?.simulacao).toEqual(atualizada);
  });
});
