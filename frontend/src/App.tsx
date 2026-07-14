import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '@/components/PrivateRoute';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import CriarSociedadePage from '@/pages/CriarSociedadePage';
import EntrarSociedadePage from '@/pages/EntrarSociedadePage';
import SociosPage from '@/pages/SociosPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sociedades/nova" element={<CriarSociedadePage />} />
          <Route path="/sociedades/entrar" element={<EntrarSociedadePage />} />
          <Route path="/sociedades/:id/socios" element={<SociosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
