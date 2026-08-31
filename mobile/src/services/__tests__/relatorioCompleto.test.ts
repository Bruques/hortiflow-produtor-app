import { buscarRelatorioCompletoPersonalizadoRequest, buscarRelatorioCompletoRequest } from '../simulacao';
import apiClient from '../apiClient';
import type { RelatorioCompleto } from '../../types/simulacao';

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const relatorio: RelatorioCompleto = {
  periodo: { data_inicio: '2026-08-01', data_fim: '2026-08-02' },
  receita: 1000,
  despesas: 400,
  lucroLiquido: 600,
  divisao: [{ socio_id: 'sc-1', nome: 'Eduardo', percentual: 60, valor: 360 }],
  quantidadePorUnidade: [{ unidade_id: 'un-1', unidade_nome: 'Caixa', quantidade: 20 }],
  mediaPrecoPorUnidade: [{ unidade_id: 'un-1', unidade_nome: 'Caixa', media_preco: 50 }],
  despesasPorCategoria: [{ tipo: 'ADUBO', valor: 400, percentual: 100 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockResolvedValue({ data: relatorio });
});

// Confirma o contrato de GET /safras/:id/relatorio-completo (docs/specs/mobile/
// 10-relatorio-completo.md), mesmo endpoint já validado no web (docs/specs/21-relatorio-completo.md).
describe('buscarRelatorioCompletoRequest', () => {
  it('busca por período fixo', async () => {
    const resultado = await buscarRelatorioCompletoRequest('sf-1', 'mes');
    expect(apiClient.get).toHaveBeenCalledWith('/safras/sf-1/relatorio-completo', { params: { periodo: 'mes' } });
    expect(resultado).toEqual(relatorio);
  });

  it('busca por intervalo personalizado', async () => {
    const resultado = await buscarRelatorioCompletoPersonalizadoRequest('sf-1', '2026-08-01', '2026-08-02');
    expect(apiClient.get).toHaveBeenCalledWith('/safras/sf-1/relatorio-completo', {
      params: { data_inicio: '2026-08-01', data_fim: '2026-08-02' },
    });
    expect(resultado).toEqual(relatorio);
  });
});
