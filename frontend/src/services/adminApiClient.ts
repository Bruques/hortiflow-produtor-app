import axios from 'axios';

// Spec 18 — cliente HTTP separado do apiClient de produtor: usa um token diferente
// (localStorage 'adminToken', não 'token') porque o login de admin é uma conta totalmente
// separada (AdminUsuario), sem nenhuma relação com contas de produtor (Usuario).
const adminApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/admin/login') {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default adminApiClient;
