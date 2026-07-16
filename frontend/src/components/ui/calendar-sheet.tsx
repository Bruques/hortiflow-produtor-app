import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarSheetProps {
  aberto: boolean;
  valor: string; // yyyy-mm-dd ou ''
  onSelecionar: (iso: string) => void;
  onFechar: () => void;
}

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function paraISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mesInicial(valor: string): { ano: number; mes: number } {
  const base = valor ? new Date(`${valor}T00:00:00`) : new Date();
  return { ano: base.getFullYear(), mes: base.getMonth() };
}

export function CalendarSheet({ aberto, valor, onSelecionar, onFechar }: CalendarSheetProps) {
  const [{ ano, mes }, setMesExibido] = useState(() => mesInicial(valor));

  // Sempre que a sheet é reaberta, volta a mostrar o mês da data atualmente selecionada (ou o
  // mês corrente, se nada selecionado) — evita abrir "preso" no mês que ficou de uma navegação
  // anterior por Anterior/Próximo sem confirmar nenhum dia.
  useEffect(() => {
    if (aberto) setMesExibido(mesInicial(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const hoje = new Date();
  const hojeISO = paraISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  function irParaMes(delta: number) {
    const novaData = new Date(ano, mes + delta, 1);
    setMesExibido({ ano: novaData.getFullYear(), mes: novaData.getMonth() });
  }

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
          'fixed left-0 right-0 bottom-0 z-30 mx-auto w-full max-w-sm rounded-t-3xl bg-white px-5 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] transition-transform duration-200',
          aberto ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hf-line" />

        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => irParaMes(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-hf-stone-700 hover:bg-hf-cream-100"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <span className="text-[14.5px] font-extrabold text-hf-stone-900">
            {MESES[mes]} {ano}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => irParaMes(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-hf-stone-700 hover:bg-hf-cream-100"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i} className="py-1 text-[11px] font-bold uppercase text-hf-stone-400">
              {d}
            </span>
          ))}
          {celulas.map((dia, i) => {
            if (dia === null) return <span key={`vazio-${i}`} />;
            const iso = paraISO(ano, mes, dia);
            const selecionado = iso === valor;
            const ehHoje = iso === hojeISO;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelecionar(iso)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-[13.5px] font-bold',
                  selecionado
                    ? 'bg-hf-green-800 text-white'
                    : ehHoje
                      ? 'text-hf-green-700 ring-[1.5px] ring-hf-green-700'
                      : 'text-hf-stone-900 hover:bg-hf-cream-100'
                )}
              >
                {dia}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onFechar}
          className="mt-4 w-full py-1 text-center text-[12.5px] font-bold text-hf-stone-600"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}
