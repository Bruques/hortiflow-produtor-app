import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { CalendarSheet } from './calendar-sheet';

export interface DateSelectorChipProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function rotulo(iso: string): string {
  if (!iso) return 'Selecionar data';
  const [, mes, dia] = iso.split('-').map(Number);
  const texto = `${dia} ${MESES_ABREV[mes - 1]}`;
  return iso === hojeISO() ? `Hoje, ${texto}` : texto;
}

// Chip único que substitui o antigo par de botões "Hoje" / "Outra data" — sempre mostra a data
// escolhida (hoje, por padrão) e abre o CalendarSheet ao ser tocado, em vez de precisar
// selecionar "Outra data" primeiro pra só então ver o calendário. Ícone de calendário + seta
// indicam que é um seletor, não um rótulo estático (wireframe aprovado em 2026-08-05).
export function DateSelectorChip({ value, onChange }: DateSelectorChipProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-hf-green-800 bg-hf-green-800 px-3.5 py-2 text-[12.5px] font-bold text-white"
      >
        <Calendar className="h-[13px] w-[13px]" strokeWidth={2} />
        {rotulo(value)}
        <ChevronDown className="h-[11px] w-[11px] opacity-85" strokeWidth={2.6} />
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
