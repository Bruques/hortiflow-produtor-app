import { useNavigate, Link } from 'react-router-dom';
import { PiggyBank, FileText, Settings, Sprout, LogOut, ChevronRight } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { useSafraAtiva } from '@/lib/SafraContext';

// Reúne o que não coube nas 4 abas da bottom nav v2 (Resumo/Despesas/Vendas/Menu) —
// Acertos e Despesas pessoais, que eram abas na v1, mais os ajustes de sociedade
// (percentuais, regras recorrentes) que já existiam como telas soltas.
export default function MenuPage() {
  const { safraId, sociedadeId } = useSafraAtiva();
  const navigate = useNavigate();

  const itens = [
    {
      href: `/safras/${safraId}/despesas-pessoais`,
      label: 'Despesas pessoais',
      apoio: 'Seus gastos privados, fora da conta da sociedade',
      Icon: PiggyBank,
      bg: 'bg-hf-blue-bg',
      cor: 'text-hf-blue',
    },
    {
      href: `/safras/${safraId}/acertos`,
      label: 'Acertos',
      apoio: 'Histórico e registro de acertos entre os sócios',
      Icon: FileText,
      bg: 'bg-hf-amber-bg',
      cor: 'text-hf-amber',
    },
    {
      href: `/sociedades/${sociedadeId}/configuracoes`,
      label: 'Configurações',
      apoio: 'Percentual de lucro dos sócios e despesas recorrentes',
      Icon: Settings,
      bg: 'bg-hf-green-100',
      cor: 'text-hf-green-700',
    },
    {
      href: `/sociedades/${sociedadeId}/safras`,
      label: 'Abrir nova safra',
      apoio: 'Começa a próxima temporada nesta mesma propriedade',
      Icon: Sprout,
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

      <div className="mx-auto flex max-w-sm flex-col gap-2 px-5 pb-6 pt-3">
        <h1 className="font-rounded mb-1 text-xl font-extrabold text-hf-stone-900">Menu</h1>

        {itens.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center gap-3 rounded-2xl border border-hf-line bg-white p-3.5"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.bg}`}>
              <item.Icon className={`h-5 w-5 ${item.cor}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-hf-stone-900">{item.label}</p>
              <p className="text-xs text-hf-stone-600">{item.apoio}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-hf-stone-400" />
          </Link>
        ))}

        <button
          type="button"
          onClick={sair}
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-sm font-bold text-hf-red"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );
}
