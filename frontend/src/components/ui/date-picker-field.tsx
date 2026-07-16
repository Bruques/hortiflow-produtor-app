import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { CalendarSheet } from './calendar-sheet';

export interface DatePickerFieldProps {
  id?: string;
  value: string; // yyyy-mm-dd ou ''
  onChange: (value: string) => void;
}

function isoParaExibicao(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

// Abre um calendário visual (CalendarSheet) em vez do usuário ter que digitar a data — troca
// feita a pedido do dev depois de perceber que digitar dd/mm/aaaa era menos amigável que só
// tocar no dia certo.
export function DatePickerField({ id, value, onChange }: DatePickerFieldProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border-[1.5px] border-hf-line bg-white px-3.5 text-left text-[14px] font-semibold text-hf-stone-900"
      >
        <Calendar className="h-[17px] w-[17px] shrink-0 text-hf-stone-400" strokeWidth={2} />
        {value ? isoParaExibicao(value) : <span className="text-hf-stone-400">Selecionar data</span>}
      </button>

      <CalendarSheet
        aberto={aberto}
        valor={value}
        onSelecionar={(iso) => {
          onChange(iso);
          setAberto(false);
        }}
        onFechar={() => setAberto(false)}
      />
    </>
  );
}
