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
    // Spec 26 — aceite de termos pendente (usuário já cadastrado, versão vigente mudou ou
    // ele nunca aceitou). Assim como o 402 de assinatura vencida abaixo, não desloga: só
    // redireciona pra tela que resolve a pendência.
    if (error.response?.status === 401 && error.response?.data?.error === 'TERMOS_PENDENTES') {
      if (window.location.pathname !== '/termos/aceite') {
        window.location.href = '/termos/aceite';
      }
      return Promise.reject(error);
    }

    // Rotas onde um 401 significa "senha incorreta" numa segunda checagem (não sessão
    // expirada) — excluir conta e trocar senha. Sem essa exceção, o redirect abaixo dispara
    // antes do componente conseguir mostrar o erro na tela: por fora parece que o app fechou.
    const url = error.config?.url ?? '';
    const isSenhaLocal =
      (error.config?.method === 'delete' && url.includes('/auth/me')) || url.includes('/auth/senha');

    if (error.response?.status === 401 && !isSenhaLocal && window.location.pathname !== '/login') {
      // Registro de auditoria best-effort (spec 17) — chamado direto por essa instância (não
      // por services/auth.ts) pra não criar import circular entre apiClient e auth.
      apiClient.post('/auth/logout', { automatico: true }).catch(() => {});
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    // Spec 18 — assinatura vencida (do titular da sociedade/safra acessada). Diferente do
    // 401, não desloga: o usuário continua autenticado, só é redirecionado pra tela que
    // explica o bloqueio e como regularizar.
    if (error.response?.status === 402 && window.location.pathname !== '/assinatura/bloqueio') {
      window.location.href = '/assinatura/bloqueio';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
