import { cn } from '@/lib/utils';
import type { PeriodoFiltro } from '@/types/simulacao';

const OPCOES: { valor: PeriodoFiltro; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra' },
];

interface PeriodToggleProps {
  value: PeriodoFiltro;
  onChange: (valor: PeriodoFiltro) => void;
}

// Segmented control reaproveitado em qualquer tela que filtre por período — hoje só a
// Início, mas mapeia direto pro parâmetro `periodo` de GET /safras/:id/simulacao
// (docs/specs/05-calculo-e-painel-simulacao.md), então outras telas podem usar sem mudança.
export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div role="tablist" aria-label="Período" className="flex gap-0.5 rounded-xl bg-hf-cream-100 p-1">
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          role="tab"
          aria-selected={value === opcao.valor}
          onClick={() => onChange(opcao.valor)}
          className={cn(
            'flex-1 rounded-lg py-2 text-[12.5px] font-bold transition-colors',
            value === opcao.valor
              ? 'bg-white text-hf-green-800 shadow-sm'
              : 'text-hf-stone-600 hover:text-hf-stone-900'
          )}
        >
          {opcao.label}
        </button>
      ))}
    </div>
  );
}
