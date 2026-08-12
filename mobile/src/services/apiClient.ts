import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getToken } from '../lib/tokenStorage';

// Extraído como função própria (em vez de inline no `.use(...)`) para ser testável sem
// precisar montar uma request Axios de verdade — ver src/services/__tests__/apiClient.test.ts.
export async function anexarTokenNoHeader(
  config: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig> {
  const token = await getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}

// Sem timeout, uma requisição travada (nem sucesso nem erro) nunca resolve — como a fila de
// sincronização processa um item por vez (syncQueue.ts), isso trava a fila inteira até o
// processo do app ser encerrado, deixando itens presos em "erro" que nunca chegam a ser
// tentados de novo (bug relatado 2026-08-12: venda presa em erro mesmo com internet).
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(anexarTokenNoHeader);

export default apiClient;
