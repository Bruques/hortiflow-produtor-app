import { obterRelatorioCompletoCache, salvarRelatorioCompletoCache } from '../relatorioCompletoCache';
import type { RelatorioCompleto } from '../../types/simulacao';

// Fake mínimo do banco em memória, mesmo padrão de simulacaoCache.test.ts.
let mockLinhas: Record<string, unknown>[] = [];

jest.mock('../database', () => ({
  getDatabase: async () => ({
    runAsync: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('INSERT OR REPLACE INTO relatorio_completo_cache')) {
        const [
          chave,
          safra_id,
          data_inicio,
          data_fim,
          receita,
          despesas,
          lucro_liquido,
          divisao,
          quantidade_por_unidade,
          media_preco_por_unidade,
          despesas_por_categoria,
          atualizado_em,
        ] = params;
        mockLinhas = mockLinhas.filter((l) => l.chave !== chave);
        mockLinhas.push({
          chave,
          safra_id,
          data_inicio,
          data_fim,
          receita,
          despesas,
          lucro_liquido,
          divisao,
          quantidade_por_unidade,
          media_preco_por_unidade,
          despesas_por_categoria,
          atualizado_em,
        });
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

const relatorio: RelatorioCompleto = {
  periodo: { data_inicio: '2026-08-01', data_fim: '2026-08-01' },
  receita: 1000,
  despesas: 400,
  lucroLiquido: 600,
  divisao: [{ socio_id: 'sc-1', nome: 'Eduardo', percentual: 60, valor: 360 }],
  quantidadePorUnidade: [{ unidade_id: 'un-1', unidade_nome: 'Caixa', quantidade: 20 }],
  mediaPrecoPorUnidade: [{ unidade_id: 'un-1', unidade_nome: 'Caixa', media_preco: 50 }],
  despesasPorCategoria: [{ tipo: 'ADUBO', valor: 400, percentual: 100 }],
};

describe('relatorioCompletoCache', () => {
  it('não há nada salvo pra um filtro nunca carregado', async () => {
    expect(await obterRelatorioCompletoCache('sf-1', { periodo: 'mes' })).toBeNull();
  });

  it('salva e devolve o relatório de um período fixo', async () => {
    await salvarRelatorioCompletoCache('sf-1', { periodo: 'mes' }, relatorio);
    const cache = await obterRelatorioCompletoCache('sf-1', { periodo: 'mes' });
    expect(cache?.relatorio).toEqual(relatorio);
    expect(cache?.atualizadoEm).toEqual(expect.any(String));
  });

  it('não mistura o cache de períodos diferentes da mesma safra', async () => {
    await salvarRelatorioCompletoCache('sf-1', { periodo: 'mes' }, relatorio);
    expect(await obterRelatorioCompletoCache('sf-1', { periodo: 'semana' })).toBeNull();
  });

  it('cacheia um intervalo personalizado separado do período fixo', async () => {
    const personalizado = { ...relatorio, lucroLiquido: 900 };
    await salvarRelatorioCompletoCache('sf-1', { periodo: 'mes' }, relatorio);
    await salvarRelatorioCompletoCache('sf-1', { dataInicio: '2026-07-01', dataFim: '2026-07-31' }, personalizado);

    expect((await obterRelatorioCompletoCache('sf-1', { periodo: 'mes' }))?.relatorio).toEqual(relatorio);
    expect(
      (await obterRelatorioCompletoCache('sf-1', { dataInicio: '2026-07-01', dataFim: '2026-07-31' }))?.relatorio
    ).toEqual(personalizado);
  });

  it('substitui o cache do mesmo filtro numa nova busca', async () => {
    await salvarRelatorioCompletoCache('sf-1', { periodo: 'mes' }, relatorio);
    const atualizado = { ...relatorio, lucroLiquido: 700 };
    await salvarRelatorioCompletoCache('sf-1', { periodo: 'mes' }, atualizado);
    expect((await obterRelatorioCompletoCache('sf-1', { periodo: 'mes' }))?.relatorio).toEqual(atualizado);
  });
});
