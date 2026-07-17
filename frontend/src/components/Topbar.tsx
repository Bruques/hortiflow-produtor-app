import { BrandIcon } from '@/components/BrandMark';

// Aparece em toda tela com bottom nav (docs/design/notas-de-design.md). Menu e notificações
// foram removidos daqui (2026-07-17): o Menu já é acessível pela aba "Menu" da bottom nav v2,
// e notificações não existem no produto ainda (Fase 2).
export function Topbar() {
  return (
    <div className="flex items-center justify-center px-5 pb-1 pt-2">
      <div className="flex items-center gap-2">
        <BrandIcon className="h-[30px] w-[30px] text-hf-green-700" />
        <div className="font-rounded leading-tight">
          <div className="text-[15px] font-extrabold text-hf-green-700">HortiFlow</div>
          <div className="text-[7.5px] font-bold tracking-[0.22em] text-hf-green-600">PRODUTOR</div>
        </div>
      </div>
    </div>
  );
}
