import { cn } from '@/lib/utils';
import type { PeriodoFiltro } from '@/types/simulacao';

const TODAS_OPCOES: { valor: PeriodoFiltro; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra' },
];

interface PeriodToggleProps {
  // null quando um período personalizado ou "Safra" (ver PeriodoAvancadoButton) está ativo —
  // nenhum dos botões fica marcado nesse caso.
  value: PeriodoFiltro | null;
  onChange: (valor: PeriodoFiltro) => void;
  // false nas telas de listagem (Resumo/Vendas/Despesas/Despesas pessoais): lá "Safra" mora
  // dentro do PeriodoAvancadoButton ao lado, junto do período personalizado, em vez de ser um
  // 5º/4º botão no toggle — decisão do dev, 2026-08-04. A Home mantém as 4 opções no toggle.
  incluirSafra?: boolean;
}

// Segmented control reaproveitado em qualquer tela que filtre por período — mapeia direto pro
// parâmetro `periodo` de GET /safras/:id/simulacao (docs/specs/05-calculo-e-painel-simulacao.md).
export function PeriodToggle({ value, onChange, incluirSafra = true }: PeriodToggleProps) {
  const opcoes = incluirSafra ? TODAS_OPCOES : TODAS_OPCOES.filter((o) => o.valor !== 'safra');

  return (
    <div role="tablist" aria-label="Período" className="flex flex-1 gap-0.5 rounded-xl bg-hf-cream-100 p-1">
      {opcoes.map((opcao) => (
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
