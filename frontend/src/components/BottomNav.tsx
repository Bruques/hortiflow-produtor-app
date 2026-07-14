import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  safraId: string;
}

const ITENS = [
  { rota: 'despesas', label: 'Despesas' },
  { rota: 'vendas', label: 'Vendas' },
  { rota: 'simulacao', label: 'Simulação' },
  { rota: 'acertos', label: 'Acertos' },
  { rota: 'despesas-pessoais', label: 'Pessoal' },
];

// Fixo na base da tela, só renderizado dentro do SafraLayout (ou seja, só quando existe
// uma safra ativa no contexto de navegação) — ver spec da task 7.
export function BottomNav({ safraId }: BottomNavProps) {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-sm mx-auto w-full flex">
        {ITENS.map((item) => {
          const href = `/safras/${safraId}/${item.rota}`;
          const ativo = location.pathname === href;
          return (
            <Link
              key={item.rota}
              to={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2.5 text-xs font-medium',
                ativo ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
