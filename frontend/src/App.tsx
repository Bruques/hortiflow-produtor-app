import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '@/components/PrivateRoute';
import AdminRoute from '@/components/AdminRoute';
import SafraLayout from '@/components/SafraLayout';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import EntrarSociedadePage from '@/pages/EntrarSociedadePage';
import SafrasPage from '@/pages/SafrasPage';
import NovaSafraPage from '@/pages/NovaSafraPage';
import ConfiguracoesSociosPage from '@/pages/ConfiguracoesSociosPage';
import ConfiguracoesRegrasDespesaPage from '@/pages/ConfiguracoesRegrasDespesaPage';
import ConfiguracoesUnidadesVendaPage from '@/pages/ConfiguracoesUnidadesVendaPage';
import ConfiguracoesContaPage from '@/pages/ConfiguracoesContaPage';
import DespesasPage from '@/pages/DespesasPage';
import NovaDespesaPage from '@/pages/NovaDespesaPage';
import NovaDespesaCompartilhadaPage from '@/pages/NovaDespesaCompartilhadaPage';
import DespesasPessoaisPage from '@/pages/DespesasPessoaisPage';
import NovaDespesaPessoalPage from '@/pages/NovaDespesaPessoalPage';
import VendasPage from '@/pages/VendasPage';
import NovaVendaPage from '@/pages/NovaVendaPage';
import ResumoPage from '@/pages/ResumoPage';
import MenuPage from '@/pages/MenuPage';
import AcertosPage from '@/pages/AcertosPage';
import AcertoDetalhePage from '@/pages/AcertoDetalhePage';
import NovoAcertoPage from '@/pages/NovoAcertoPage';
import RelatorioPage from '@/pages/RelatorioPage';
import RelatorioCompletoPage from '@/pages/RelatorioCompletoPage';
import AssinaturaBloqueadaPage from '@/pages/AssinaturaBloqueadaPage';
import MinhaAssinaturaPage from '@/pages/MinhaAssinaturaPage';
import AdminAssinaturasPage from '@/pages/admin/AdminAssinaturasPage';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin/assinaturas" element={<AdminAssinaturasPage />} />
        </Route>
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/assinatura" element={<MinhaAssinaturaPage />} />
          <Route path="/assinatura/bloqueio" element={<AssinaturaBloqueadaPage />} />
          <Route path="/despesas/compartilhada" element={<NovaDespesaCompartilhadaPage />} />
          <Route path="/sociedades/entrar" element={<EntrarSociedadePage />} />
          <Route path="/sociedades/:id/safras" element={<SafrasPage />} />
          <Route path="/sociedades/:id/safras/nova" element={<NovaSafraPage />} />
          <Route path="/sociedades/:id/configuracoes/socios" element={<ConfiguracoesSociosPage />} />
          <Route path="/sociedades/:id/configuracoes/regras-despesa" element={<ConfiguracoesRegrasDespesaPage />} />
          <Route path="/sociedades/:id/configuracoes/unidades-de-venda" element={<ConfiguracoesUnidadesVendaPage />} />
          <Route path="/sociedades/:id/configuracoes/conta" element={<ConfiguracoesContaPage />} />
          <Route path="/acertos/:id" element={<AcertoDetalhePage />} />
          <Route path="/safras/:id" element={<SafraLayout />}>
            <Route index element={<ResumoPage />} />
            <Route path="despesas" element={<DespesasPage />} />
            <Route path="despesas/nova" element={<NovaDespesaPage />} />
            <Route path="despesas/:despesaId/editar" element={<NovaDespesaPage />} />
            <Route path="despesas-pessoais" element={<DespesasPessoaisPage />} />
            <Route path="despesas-pessoais/nova" element={<NovaDespesaPessoalPage />} />
            <Route path="despesas-pessoais/:despesaPessoalId/editar" element={<NovaDespesaPessoalPage />} />
            <Route path="vendas" element={<VendasPage />} />
            <Route path="vendas/nova" element={<NovaVendaPage />} />
            <Route path="vendas/:vendaId/editar" element={<NovaVendaPage />} />
            <Route path="acertos" element={<AcertosPage />} />
            <Route path="acertos/novo" element={<NovoAcertoPage />} />
            <Route path="relatorio" element={<RelatorioPage />} />
            <Route path="relatorio-completo" element={<RelatorioCompletoPage />} />
            <Route path="menu" element={<MenuPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
