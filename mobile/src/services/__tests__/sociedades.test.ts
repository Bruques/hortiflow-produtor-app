import { AxiosError } from 'axios';
import {
  atualizarPercentuaisRequest,
  criarSociedadeRequest,
  criarSocioRequest,
  editarNomeSocioRequest,
  entrarSociedadeRequest,
  removerSocioRequest,
} from '../sociedades';
import apiClient from '../apiClient';
import { enfileirar } from '../../lib/syncQueue';

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../lib/syncQueue', () => ({
  enfileirar: jest.fn(),
}));

// Reforça a regra de negócio da spec (docs/specs/mobile/02-sociedade-e-socios.md): ações de
// sociedade são raras e exigem confirmação imediata do servidor, então NUNCA devem cair na
// fila de sincronização genérica (spec 00), mesmo quando a chamada falha por estar offline —
// diferente de despesas/vendas (specs futuras), que enfileiram.
function erroDeRede(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK');
}

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.post as jest.Mock).mockRejectedValue(erroDeRede());
  (apiClient.put as jest.Mock).mockRejectedValue(erroDeRede());
  (apiClient.patch as jest.Mock).mockRejectedValue(erroDeRede());
  (apiClient.delete as jest.Mock).mockRejectedValue(erroDeRede());
});

describe('ações de sociedade offline não enfileiram nada', () => {
  it('criar sociedade', async () => {
    await expect(criarSociedadeRequest('Sítio Boa Vista')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('entrar por código', async () => {
    await expect(entrarSociedadeRequest('482913')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('atualizar percentuais', async () => {
    await expect(
      atualizarPercentuaisRequest('soc-1', [{ id: 'sc-1', percentual_lucro: 100, papel: 'FINANCIADOR' }])
    ).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('adicionar sócio sem conta', async () => {
    await expect(criarSocioRequest('soc-1', 'João', 'MEEIRO')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('editar nome de sócio sem conta', async () => {
    await expect(editarNomeSocioRequest('soc-1', 'sc-1', 'João da Silva')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });

  it('remover sócio', async () => {
    await expect(removerSocioRequest('soc-1', 'sc-1')).rejects.toThrow();
    expect(enfileirar).not.toHaveBeenCalled();
  });
});
