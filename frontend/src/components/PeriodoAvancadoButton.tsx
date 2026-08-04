import { useState } from 'react';
import { Calendar, Sprout } from 'lucide-react';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { cn } from '@/lib/utils';
import type { PeriodoFiltro } from '@/types/simulacao';

export interface PeriodoPersonalizado {
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
}

interface PeriodoAvancadoButtonProps {
  periodo: PeriodoFiltro | null;
  periodoPersonalizado: PeriodoPersonalizado | null;
  onSelecionarPeriodo: (valor: PeriodoFiltro) => void;
  onSelecionarPeriodoPersonalizado: (valor: PeriodoPersonalizado | null) => void;
}

// Botão só de ícone, ao lado do PeriodToggle (que agora só tem Hoje/Semana/Mês) — abre uma
// folha com "Safra inteira" (que saiu do toggle) e o período personalizado (De/Até), os dois
// casos que não cabem como 4º/5º botão do segmented control. Decisão do dev, 2026-08-04:
// volta ao padrão de abas pro período rápido, mas mantém o dropdown só pro status em Vendas.
export function PeriodoAvancadoButton({
  periodo,
  periodoPersonalizado,
  onSelecionarPeriodo,
  onSelecionarPeriodoPersonalizado,
}: PeriodoAvancadoButtonProps) {
  const [aberto, setAberto] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const safraSelecionada = periodo === 'safra' && !periodoPersonalizado;
  const ativo = safraSelecionada || !!periodoPersonalizado;

  function abrir() {
    setDataInicio(periodoPersonalizado?.dataInicio ?? '');
    setDataFim(periodoPersonalizado?.dataFim ?? '');
    setAberto(true);
  }

  function selecionarSafra() {
    onSelecionarPeriodo('safra');
    setAberto(false);
  }

  function aplicarPersonalizado() {
    if (!dataInicio || !dataFim) return;
    onSelecionarPeriodoPersonalizado({ dataInicio, dataFim });
    setAberto(false);
  }

  function removerPersonalizado() {
    onSelecionarPeriodoPersonalizado(null);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Mais períodos: safra inteira ou personalizado"
        className={cn(
          'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl transition-colors',
          ativo ? 'bg-hf-green-800 text-white' : 'bg-hf-cream-100 text-hf-stone-600 hover:text-hf-stone-900'
        )}
      >
        <Calendar className="h-4 w-4" strokeWidth={2} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-20 bg-black/45" onClick={() => setAberto(false)} />
          <div
            className="fixed left-0 right-0 bottom-0 z-30 mx-auto w-full max-w-sm rounded-t-3xl bg-white px-5 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.15)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hf-line" />

            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-hf-green-100 text-hf-green-800">
                <Calendar className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-[14.5px] font-extrabold text-hf-stone-900">Mais períodos</h3>
                <p className="text-[11px] text-hf-stone-600">Safra inteira ou um intervalo específico</p>
              </div>
            </div>

            <button
              type="button"
              onClick={selecionarSafra}
              className={cn(
                'mb-4 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                safraSelecionada ? 'bg-hf-green-100' : ''
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-hf-green-100 text-hf-green-800">
                <Sprout className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
              <span className="flex-1 text-[13px] font-bold text-hf-stone-900">Safra inteira</span>
              <span
                className={cn(
                  'h-[17px] w-[17px] shrink-0 rounded-full border-[1.5px]',
                  safraSelecionada ? 'border-hf-green-800 bg-hf-green-800 ring-[3px] ring-inset ring-white' : 'border-hf-line'
                )}
              />
            </button>

            <div className="mb-4 flex items-center gap-2.5">
              <div className="h-px flex-1 bg-hf-line" />
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-hf-stone-400">
                ou personalizado
              </span>
              <div className="h-px flex-1 bg-hf-line" />
            </div>

            <div className="mb-4 flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wide text-hf-stone-400">Início</label>
                <DatePickerField value={dataInicio} onChange={setDataInicio} />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wide text-hf-stone-400">Fim</label>
                <DatePickerField value={dataFim} onChange={setDataFim} />
              </div>
            </div>

            <button
              type="button"
              onClick={aplicarPersonalizado}
              disabled={!dataInicio || !dataFim}
              className="mb-2 w-full rounded-xl bg-hf-green-800 py-3 text-center text-[14px] font-extrabold text-white disabled:opacity-40"
            >
              Aplicar
            </button>

            {periodoPersonalizado && (
              <button
                type="button"
                onClick={removerPersonalizado}
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
