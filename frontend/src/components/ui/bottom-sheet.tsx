import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}

// Chrome genérico de folha (fundo escurecido + alça + cantos arredondados), extraído de
// calendar-sheet.tsx pra ser reaproveitado por qualquer conteúdo que precise abrir numa folha
// controlada de fora (sem gatilho próprio, diferente do DropdownSheet) — mesmo papel do
// BottomSheet.tsx do mobile (docs/specs/04, adendo 2026-08-04).
export function BottomSheet({ aberto, onFechar, children }: BottomSheetProps) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-20 bg-black/45 transition-opacity',
          aberto ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onFechar}
      />

      <div
        className={cn(
          'fixed left-0 right-0 bottom-0 z-30 mx-auto flex w-full max-w-sm flex-col rounded-t-3xl bg-white px-5 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] transition-transform duration-200',
          aberto ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)', maxHeight: '85vh' }}
      >
        <div className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-full bg-hf-line" />
        {children}
      </div>
    </>
  );
}
