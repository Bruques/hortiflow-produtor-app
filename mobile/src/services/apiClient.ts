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

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

apiClient.interceptors.request.use(anexarTokenNoHeader);

export default apiClient;
