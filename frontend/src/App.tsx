import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '@/components/PrivateRoute';
import SafraLayout from '@/components/SafraLayout';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import EntrarSociedadePage from '@/pages/EntrarSociedadePage';
import SociosPage from '@/pages/SociosPage';
import SafrasPage from '@/pages/SafrasPage';
import DespesasPage from '@/pages/DespesasPage';
import DespesasPessoaisPage from '@/pages/DespesasPessoaisPage';
import VendasPage from '@/pages/VendasPage';
import RegrasRecorrentesPage from '@/pages/RegrasRecorrentesPage';
import ResumoPage from '@/pages/ResumoPage';
import MenuPage from '@/pages/MenuPage';
import AcertosPage from '@/pages/AcertosPage';
import AcertoDetalhePage from '@/pages/AcertoDetalhePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sociedades/entrar" element={<EntrarSociedadePage />} />
          <Route path="/sociedades/:id/socios" element={<SociosPage />} />
          <Route path="/sociedades/:id/safras" element={<SafrasPage />} />
          <Route path="/sociedades/:id/regras-recorrentes" element={<RegrasRecorrentesPage />} />
          <Route path="/acertos/:id" element={<AcertoDetalhePage />} />
          <Route path="/safras/:id" element={<SafraLayout />}>
            <Route index element={<ResumoPage />} />
            <Route path="despesas" element={<DespesasPage />} />
            <Route path="despesas-pessoais" element={<DespesasPessoaisPage />} />
            <Route path="vendas" element={<VendasPage />} />
            <Route path="acertos" element={<AcertosPage />} />
            <Route path="menu" element={<MenuPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
