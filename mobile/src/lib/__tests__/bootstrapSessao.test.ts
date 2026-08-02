import { AxiosError, AxiosHeaders } from 'axios';
import { deveDeslogarPorErro } from '../bootstrapSessao';

function criarErro401(): AxiosError {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    data: { error: 'Sessão expirada' },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

describe('deveDeslogarPorErro', () => {
  it('desloga quando o erro é um 401 explícito de /auth/me', () => {
    expect(deveDeslogarPorErro(criarErro401())).toBe(true);
  });

  it('mantém a sessão quando é erro de rede (Axios sem response, ex: timeout/offline)', () => {
    const erroDeRede = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(deveDeslogarPorErro(erroDeRede)).toBe(false);
  });

  it('mantém a sessão em sucesso (nenhum erro a classificar)', () => {
    expect(deveDeslogarPorErro(undefined)).toBe(false);
  });

  it('mantém a sessão para erro genérico não vindo do Axios', () => {
    expect(deveDeslogarPorErro(new Error('algo inesperado'))).toBe(false);
  });
});
