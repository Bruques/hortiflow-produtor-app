import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, ShoppingCart, Menu as MenuIcon, Plus, CirclePlus, CircleMinus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavV2Props {
  safraId: string;
}

const ITENS = [
  { rota: '', label: 'Resumo', Icon: Home },
  { rota: 'vendas', label: 'Vendas', Icon: ShoppingCart },
] as const;

const ITENS_DIREITA = [
  { rota: 'despesas', label: 'Despesas', Icon: Wallet },
  { rota: 'menu', label: 'Menu', Icon: MenuIcon },
] as const;

// Navbar v2 (decisão confirmada em docs/design/notas-de-design.md): 4 abas fixas
// (Resumo/Despesas/Vendas/Menu) + FAB central que abre a folha de opções pra registrar
// venda ou despesa, sem precisar navegar até a lista antes. "Acertos" e "Despesas pessoais"
// não cabem nas 4 abas — ficam dentro do Menu (ver MenuPage).
export function BottomNavV2({ safraId }: BottomNavV2Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  function href(rota: string) {
    return rota ? `/safras/${safraId}/${rota}` : `/safras/${safraId}`;
  }

  function irPara(rota: string) {
    setAberto(false);
    navigate(href(rota));
  }

  function NavLink({ rota, label, Icon }: { rota: string; label: string; Icon: typeof Home }) {
    const ativo = location.pathname === href(rota);
    return (
      <Link
        to={href(rota)}
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold',
          ativo ? 'text-hf-green-700' : 'text-hf-stone-400'
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={ativo ? 2.4 : 2} />
        {label}
      </Link>
    );
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-20 bg-black/45 transition-opacity',
          aberto ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setAberto(false)}
      />

      <div
        className={cn(
          'fixed left-0 right-0 bottom-0 z-30 mx-auto w-full max-w-sm rounded-t-3xl bg-white px-5 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] transition-transform duration-200',
          aberto ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 30px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hf-line" />
        <p className="mb-3.5 text-center text-[12.5px] font-bold uppercase tracking-wide text-hf-stone-400">
          O que você quer registrar?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => irPara('vendas/nova')}
            className="flex flex-1 flex-col items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line bg-white py-4.5 px-2.5 hover:bg-hf-cream-100"
          >
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-hf-green-100">
              <CirclePlus className="h-6 w-6 text-hf-green-600" />
            </div>
            <span className="text-[12.5px] font-bold text-hf-stone-900">Nova venda</span>
          </button>
          <button
            type="button"
            onClick={() => irPara('despesas/nova')}
            className="flex flex-1 flex-col items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line bg-white py-4.5 px-2.5 hover:bg-hf-cream-100"
          >
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-hf-red-bg">
              <CircleMinus className="h-6 w-6 text-hf-red" />
            </div>
            <span className="text-[12.5px] font-bold text-hf-stone-900">Nova despesa</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="mt-2.5 w-full py-1 text-center text-[12.5px] font-bold text-hf-stone-600"
        >
          Cancelar
        </button>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center border-t border-hf-line bg-white px-1 pt-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
      >
        <div className="relative mx-auto flex w-full max-w-sm items-center">
          {ITENS.map((item) => (
            <NavLink key={item.rota} {...item} />
          ))}
          <div className="flex-1" />
          {ITENS_DIREITA.map((item) => (
            <NavLink key={item.rota} {...item} />
          ))}

          <button
            type="button"
            aria-label="Registrar venda ou despesa"
            onClick={() => setAberto(true)}
            className="absolute left-1/2 -top-6 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-white bg-hf-green-800 text-white shadow-[0_8px_18px_rgba(18,58,36,0.4)] hover:bg-hf-green-900 active:scale-95"
          >
            <Plus className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </div>
      </nav>
    </>
  );
}
