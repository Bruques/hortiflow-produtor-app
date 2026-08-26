import { AxiosError, AxiosHeaders } from 'axios';
import { deveMostrarBloqueioAssinatura } from '../assinaturaGate';

function criarErro402(): AxiosError {
  return new AxiosError('Payment Required', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 402,
    statusText: 'Payment Required',
    data: { error: 'Seu acesso ao HortiFlow expirou.' },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

describe('deveMostrarBloqueioAssinatura', () => {
  it('mostra o bloqueio quando o erro é um 402 (assinatura vencida)', () => {
    expect(deveMostrarBloqueioAssinatura(criarErro402())).toBe(true);
  });

  it('não mostra bloqueio pra erro de rede (Axios sem response)', () => {
    const erroDeRede = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(deveMostrarBloqueioAssinatura(erroDeRede)).toBe(false);
  });

  it('não mostra bloqueio em sucesso (nenhum erro a classificar)', () => {
    expect(deveMostrarBloqueioAssinatura(undefined)).toBe(false);
  });

  it('não mostra bloqueio para erro genérico não vindo do Axios', () => {
    expect(deveMostrarBloqueioAssinatura(new Error('algo inesperado'))).toBe(false);
  });

  it('não mostra bloqueio pra um 401 (esse caso é do deveDeslogarPorErro, não deste)', () => {
    const erro401 = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      data: {},
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    });
    expect(deveMostrarBloqueioAssinatura(erro401)).toBe(false);
  });
});
