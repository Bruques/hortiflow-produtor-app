import { buscarSimulacaoPersonalizadaRequest, buscarSimulacaoRequest } from '../simulacao';
import apiClient from '../apiClient';
import type { Simulacao } from '../../types/simulacao';

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const simulacao: Simulacao = {
  periodo: { data_inicio: '2026-08-01', data_fim: '2026-08-02' },
  receita: 1000,
  despesas: 400,
  lucroLiquido: 600,
  divisao: [{ socio_id: 'sc-1', nome: 'Eduardo', percentual: 60, valor: 360 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockResolvedValue({ data: simulacao });
});

// Confirma o contrato de GET /safras/:id/simulacao (docs/specs/mobile/05-painel-e-acerto.md) —
// e, junto com isso, que o valor devolvido é exatamente o payload da API, sem nenhuma soma ou
// aplicação de percentual no meio (regra crítica do CLAUDE.md: cálculo de divisão isolado).
describe('simulacao', () => {
  it('busca por período fixo', async () => {
    const resultado = await buscarSimulacaoRequest('sf-1', 'semana');
    expect(apiClient.get).toHaveBeenCalledWith('/safras/sf-1/simulacao', { params: { periodo: 'semana' } });
    expect(resultado).toEqual(simulacao);
  });

  it('busca por intervalo personalizado', async () => {
    const resultado = await buscarSimulacaoPersonalizadaRequest('sf-1', '2026-08-01', '2026-08-02');
    expect(apiClient.get).toHaveBeenCalledWith('/safras/sf-1/simulacao', {
      params: { data_inicio: '2026-08-01', data_fim: '2026-08-02' },
    });
    expect(resultado).toEqual(simulacao);
  });
});
