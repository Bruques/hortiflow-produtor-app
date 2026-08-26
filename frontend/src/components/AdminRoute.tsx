import { Navigate, Outlet } from 'react-router-dom';

// Spec 18 — protege /admin/*. Só olha o 'adminToken' no localStorage (mesmo padrão do
// PrivateRoute de produtor, só que com uma chave e um login completamente separados).
export default function AdminRoute() {
  const token = localStorage.getItem('adminToken');
  return token ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
