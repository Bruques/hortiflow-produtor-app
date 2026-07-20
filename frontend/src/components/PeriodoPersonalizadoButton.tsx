import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { formatarData } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface PeriodoPersonalizado {
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
}

interface PeriodoPersonalizadoButtonProps {
  value: PeriodoPersonalizado | null;
  onChange: (valor: PeriodoPersonalizado | null) => void;
}

// Botão de calendário que fica ao lado do PeriodToggle — abre uma sheet pra escolher um
// intervalo de datas arbitrário (ex: só ontem, ou uma semana específica que não é a atual).
// Fica fora do PeriodToggle de propósito: um 5º botão apertaria o segmented control em telas
// mobile (docs/specs/05-calculo-e-painel-simulacao.md). Componente isolado dos outros filtros
// de período pra poder ser reaproveitado depois em Despesas/Vendas/Despesas Pessoais.
export function PeriodoPersonalizadoButton({ value, onChange }: PeriodoPersonalizadoButtonProps) {
  const [aberto, setAberto] = useState(false);
  const [dataInicio, setDataInicio] = useState(value?.dataInicio ?? '');
  const [dataFim, setDataFim] = useState(value?.dataFim ?? '');

  function abrir() {
    setDataInicio(value?.dataInicio ?? '');
    setDataFim(value?.dataFim ?? '');
    setAberto(true);
  }

  function aplicar() {
    if (!dataInicio || !dataFim) return;
    onChange({ dataInicio, dataFim });
    setAberto(false);
  }

  function limpar() {
    onChange(null);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Escolher período personalizado"
        className={cn(
          'flex h-[38px] w-full items-center justify-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-bold transition-colors',
          value ? 'bg-hf-green-800 text-white' : 'bg-hf-cream-100 text-hf-stone-600 hover:text-hf-stone-900'
        )}
      >
        <CalendarRange className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">
          {value ? `${formatarData(value.dataInicio)} - ${formatarData(value.dataFim)}` : 'Escolher período personalizado'}
        </span>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-20 bg-black/45" onClick={() => setAberto(false)} />
          <div
            className="fixed left-0 right-0 bottom-0 z-30 mx-auto w-full max-w-sm rounded-t-3xl bg-white px-5 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.15)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hf-line" />
            <h3 className="mb-3.5 text-[15px] font-extrabold text-hf-stone-900">Período personalizado</h3>

            <div className="mb-3.5 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-bold text-hf-stone-600">Data início</label>
              <DatePickerField value={dataInicio} onChange={setDataInicio} />
            </div>

            <div className="mb-4 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-bold text-hf-stone-600">Data fim</label>
              <DatePickerField value={dataFim} onChange={setDataFim} />
            </div>

            <button
              type="button"
              onClick={aplicar}
              disabled={!dataInicio || !dataFim}
              className="mb-2 w-full rounded-xl bg-hf-green-800 py-3 text-center text-[14px] font-extrabold text-white disabled:opacity-40"
            >
              Aplicar
            </button>

            {value && (
              <button
                type="button"
                onClick={limpar}
                className="w-full py-1 text-center text-[12.5px] font-bold text-hf-stone-600"
              >
                Remover filtro personalizado
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
