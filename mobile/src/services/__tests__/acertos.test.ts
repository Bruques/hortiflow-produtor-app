import { AxiosError } from 'axios';
import { buscarAcertoRequest, criarAcertoRequest, listarAcertosRequest } from '../acertos';
import apiClient from '../apiClient';
import { enfileirar } from '../../lib/syncQueue';
import type { AcertoDetalhado, AcertoResumo } from '../../types/acerto';

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));

jest.mock('../../lib/syncQueue', () => ({
  enfileirar: jest.fn(),
}));

const resumo: AcertoResumo = {
  id: 'ac-1',
  data_inicio: '2026-07-01',
  data_fim: '2026-07-31',
  tipo: 'PARCIAL',
  criado_em: '2026-08-01T12:00:00.000Z',
};

const detalhado: AcertoDetalhado = {
  ...resumo,
  safra_id: 'sf-1',
  receita: 1000,
  despesas: 400,
  lucroLiquido: 600,
  socios: [{ socio_id: 'sc-1', nome: 'Eduardo', despesas_bancadas: 400, percentual_aplicado: 60, valor_lucro: 360 }],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('acertos — leitura', () => {
  it('lista o histórico da safra', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: [resumo] });
    const resultado = await listarAcertosRequest('sf-1');
    expect(apiClient.get).toHaveBeenCalledWith('/safras/sf-1/acertos');
    expect(resultado).toEqual([resumo]);
  });

  it('busca o extrato de um acerto', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: detalhado });
    const resultado = await buscarAcertoRequest('ac-1');
    expect(apiClient.get).toHaveBeenCalledWith('/acertos/ac-1');
    expect(resultado).toEqual(detalhado);
  });
});

// Mesma regra das ações de sociedade/safra (docs/specs/mobile/02-sociedade-e-socios.md,
// reafirmada na 05): criar Acerto exige conexão e nunca cai na fila de sincronização genérica,
// mesmo se a chamada falhar por estar offline.
describe('criar acerto offline não enfileira nada', () => {
  it('propaga o erro sem enfileirar', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    await expect(
      criarAcertoRequest('sf-1', { data_inicio: '2026-07-01', data_fim: '2026-07-31', tipo: 'PARCIAL' })
    ).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('envia o payload correto quando online', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: detalhado });
    const resultado = await criarAcertoRequest('sf-1', {
      data_inicio: '2026-07-01',
      data_fim: '2026-07-31',
      tipo: 'PARCIAL',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/safras/sf-1/acertos', {
      data_inicio: '2026-07-01',
      data_fim: '2026-07-31',
      tipo: 'PARCIAL',
    });
    expect(resultado).toEqual(detalhado);
  });
});
