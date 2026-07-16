import { useNavigate } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { BrandIcon } from '@/components/BrandMark';

interface TopbarProps {
  safraId: string;
}

// Aparece em toda tela com bottom nav (docs/design/notas-de-design.md). O hambúrguer leva
// pro Menu (mesma tela da aba "Menu" da bottom nav v2) — não existe um segundo destino
// definido pro ícone, então os dois pontos de entrada apontam pro mesmo lugar em vez de um
// ficar sem função. O sino não tem selo de notificação: o produto ainda não tem nenhum
// sistema de notificação implementado (Fase 2), então mostrar um selo seria enganoso.
export function Topbar({ safraId }: TopbarProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-2">
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => navigate(`/safras/${safraId}/menu`)}
        className="p-1.5 text-hf-stone-900"
      >
        <Menu className="h-[22px] w-[22px]" strokeWidth={2} />
      </button>

      <div className="flex items-center gap-2">
        <BrandIcon className="h-[30px] w-[30px] text-hf-green-700" />
        <div className="font-rounded leading-tight">
          <div className="text-[15px] font-extrabold text-hf-green-700">HortiFlow</div>
          <div className="text-[7.5px] font-bold tracking-[0.22em] text-hf-green-600">PRODUTOR</div>
        </div>
      </div>

      <button type="button" aria-label="Notificações" className="p-1.5 text-hf-stone-900">
        <Bell className="h-[21px] w-[21px]" strokeWidth={2} />
      </button>
    </div>
  );
}
