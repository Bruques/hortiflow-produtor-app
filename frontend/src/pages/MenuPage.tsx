import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiggyBank, FileText, Users, Repeat, Package, Lock, Sprout, LogOut, type LucideIcon } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { useSafraAtiva } from '@/lib/SafraContext';
import { meRequest } from '@/services/auth';
import { listarSociosRequest } from '@/services/sociedades';

interface Item {
  href: string;
  titulo: string;
  subtitulo: string;
  Icone: LucideIcon;
  bg: string;
  cor: string;
}

// Grid única com tudo que não coube nas 4 abas da bottom nav v2 (Resumo/Despesas/Vendas/Menu):
// ações da safra (Despesas pessoais, Acertos, Abrir nova safra) e ajustes da sociedade
// (percentuais, regras recorrentes, unidades de venda, conta) — antes os ajustes ficavam
// atrás de uma tela "Configurações" intermediária, removida por ser um clique redundante
// pra chegar em algo que também cabe direto aqui.
export default function MenuPage() {
  const { safraId, sociedadeId } = useSafraAtiva();
  const navigate = useNavigate();
  const [souFinanciador, setSouFinanciador] = useState(false);

  useEffect(() => {
    if (!sociedadeId) return;
    meRequest()
      .then((res) => {
        listarSociosRequest(sociedadeId).then((r) => {
          const eu = r.socios.find((s) => s.usuario_id === res.usuario.id);
          setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
        });
      })
      .catch(() => {});
  }, [sociedadeId]);

  const itens: Item[] = [
    {
      href: `/safras/${safraId}/despesas-pessoais`,
      titulo: 'Despesas pessoais',
      subtitulo: 'Seus gastos privados',
      Icone: PiggyBank,
      bg: 'bg-hf-blue-bg',
      cor: 'text-hf-blue',
    },
    {
      href: `/safras/${safraId}/acertos`,
      titulo: 'Acertos',
      subtitulo: 'Histórico entre sócios',
      Icone: FileText,
      bg: 'bg-hf-amber-bg',
      cor: 'text-hf-amber',
    },
    {
      href: `/sociedades/${sociedadeId}/configuracoes/socios`,
      titulo: 'Sócios e Sociedade',
      subtitulo: 'Percentual de lucro, convite',
      Icone: Users,
      bg: 'bg-hf-green-100',
      cor: 'text-hf-green-800',
    },
    {
      href: `/sociedades/${sociedadeId}/configuracoes/regras-despesa`,
      titulo: 'Regras de Despesa',
      subtitulo: 'Despesas automáticas',
      Icone: Repeat,
      bg: 'bg-hf-green-100',
      cor: 'text-hf-green-800',
    },
    ...(souFinanciador
      ? [
          {
            href: `/sociedades/${sociedadeId}/configuracoes/unidades-de-venda`,
            titulo: 'Unidades de Venda',
            subtitulo: 'Caixa, Kg…',
            Icone: Package,
            bg: 'bg-hf-green-100',
            cor: 'text-hf-green-800',
          },
        ]
      : []),
    {
      href: `/sociedades/${sociedadeId}/configuracoes/conta`,
      titulo: 'Conta e Senha',
      subtitulo: 'Trocar senha',
      Icone: Lock,
      bg: 'bg-hf-green-100',
      cor: 'text-hf-green-800',
    },
    {
      href: `/sociedades/${sociedadeId}/safras`,
      titulo: 'Abrir nova safra',
      subtitulo: 'Nova temporada',
      Icone: Sprout,
      bg: 'bg-hf-amber-bg',
      cor: 'text-hf-amber',
    },
  ];

  function sair() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div>
      <Topbar />

      <div className="mx-auto flex max-w-sm flex-col gap-4 px-5 pb-6 pt-3">
        <h1 className="font-rounded text-xl font-extrabold text-hf-stone-900">Menu</h1>

        <div className="grid grid-cols-2 gap-3">
          {itens.map(({ href, titulo, subtitulo, Icone, bg, cor }) => (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className="flex flex-col items-start gap-2.5 rounded-2xl border border-hf-line bg-white p-3.5 text-left"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg} ${cor}`}>
                <Icone className="h-[18px] w-[18px]" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-extrabold leading-snug text-hf-stone-900">{titulo}</p>
                <p className="m-0 mt-0.5 text-[11px] text-hf-stone-400">{subtitulo}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={sair}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-sm font-bold text-hf-red"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );
}
