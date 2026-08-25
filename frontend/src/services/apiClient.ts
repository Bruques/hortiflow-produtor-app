import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Sem isso, um token expirado (validade de 7 dias, sem refresh) deixava o usuário preso numa
// tela de erro genérica pra sempre — a Home tratava 401 igual a qualquer outra falha de rede e
// nunca redirecionava pro login de novo.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      // Registro de auditoria best-effort (spec 17) — chamado direto por essa instância (não
      // por services/auth.ts) pra não criar import circular entre apiClient e auth.
      apiClient.post('/auth/logout', { automatico: true }).catch(() => {});
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
