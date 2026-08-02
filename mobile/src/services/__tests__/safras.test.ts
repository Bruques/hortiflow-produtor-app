import { AxiosError } from 'axios';
import { abrirSafraRequest, atualizarObservacoesRequest, encerrarSafraRequest } from '../safras';
import apiClient from '../apiClient';
import { enfileirar } from '../../lib/syncQueue';

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
}));

jest.mock('../../lib/syncQueue', () => ({
  enfileirar: jest.fn(),
}));

// Mesma regra da spec 02, reafirmada na spec 03 (docs/specs/mobile/03-safra.md): abrir/encerrar
// safra e editar observações são ações raras que exigem confirmação imediata do servidor —
// nunca caem na fila de sincronização genérica, mesmo offline.
function erroDeRede(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK');
}

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.post as jest.Mock).mockRejectedValue(erroDeRede());
  (apiClient.patch as jest.Mock).mockRejectedValue(erroDeRede());
});

describe('ações de safra offline não enfileiram nada', () => {
  it('abrir safra', async () => {
    await expect(abrirSafraRequest('soc-1', 'Safra 2026')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('encerrar safra', async () => {
    await expect(encerrarSafraRequest('sf-1')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('editar observações', async () => {
    await expect(atualizarObservacoesRequest('sf-1', 'novo texto')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });
});
