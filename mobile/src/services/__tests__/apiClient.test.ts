import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { anexarTokenNoHeader } from '../apiClient';
import { getToken } from '../../lib/tokenStorage';

jest.mock('../../lib/tokenStorage', () => ({
  getToken: jest.fn(),
}));

function criarConfig(): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
}

describe('anexarTokenNoHeader', () => {
  it('injeta o header Authorization quando há token salvo', async () => {
    (getToken as jest.Mock).mockResolvedValue('token-abc');

    const config = await anexarTokenNoHeader(criarConfig());

    expect(config.headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('não injeta o header quando não há token salvo', async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const config = await anexarTokenNoHeader(criarConfig());

    expect(config.headers.get('Authorization')).toBeUndefined();
  });
});
