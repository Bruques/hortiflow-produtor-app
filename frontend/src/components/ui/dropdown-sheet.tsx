import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownSheetProps {
  label?: string;
  displayValue?: string;
  ativo?: boolean;
  onAbrir?: () => void;
  className?: string;
  // Substitui o gatilho padrão (legenda + pílula) por um botão customizado, ex: o chip
  // compacto colorido do filtro de status — a folha que abre é sempre a mesma.
  renderTrigger?: (abrir: () => void) => ReactNode;
  children: (fechar: () => void) => ReactNode;
}

// Abre uma folha (bottom sheet) a partir de um gatilho — por padrão uma pílula com legenda
// acima ("Período", "Status"), mas o gatilho pode ser customizado via `renderTrigger`. Chrome
// extraído de PeriodoPersonalizadoButton pra ser reaproveitado por qualquer filtro que precise
// desse padrão (ver docs/design/notas-de-design.md, decisões de 2026-08-04).
export function DropdownSheet({
  label,
  displayValue,
  ativo,
  onAbrir,
  className,
  renderTrigger,
  children,
}: DropdownSheetProps) {
  const [aberto, setAberto] = useState(false);

  function abrir() {
    onAbrir?.();
    setAberto(true);
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {renderTrigger ? (
        renderTrigger(abrir)
      ) : (
        <>
          <span className="text-[10px] font-bold uppercase tracking-wide text-hf-stone-400">{label}</span>
          <button
            type="button"
            onClick={abrir}
            className={cn(
              'flex h-[38px] items-center justify-between gap-1.5 rounded-xl border-[1.5px] px-3 text-[12.5px] font-bold transition-colors',
              ativo
                ? 'border-hf-green-700 bg-hf-green-100 text-hf-green-800'
                : 'border-hf-line bg-white text-hf-stone-900'
            )}
          >
            <span className="truncate">{displayValue}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-hf-stone-400" strokeWidth={2.5} />
          </button>
        </>
      )}

      {aberto && (
        <>
          <div className="fixed inset-0 z-20 bg-black/45" onClick={() => setAberto(false)} />
          <div
            className="fixed left-0 right-0 bottom-0 z-30 mx-auto w-full max-w-sm rounded-t-3xl bg-white px-5 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.15)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hf-line" />
            {children(() => setAberto(false))}
          </div>
        </>
      )}
    </div>
  );
}
