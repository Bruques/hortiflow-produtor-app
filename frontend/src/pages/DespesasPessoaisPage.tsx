import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { PeriodToggle } from '@/components/PeriodToggle';
import { PeriodoPersonalizadoButton, type PeriodoPersonalizado } from '@/components/PeriodoPersonalizadoButton';
import { useSafraAtiva } from '@/lib/SafraContext';
import { listarDespesasPessoaisRequest } from '@/services/despesasPessoais';
import { formatarData, formatarMoeda } from '@/lib/utils';
import { dataEstaNoIntervalo, dataEstaNoPeriodo, rotuloDia } from '@/lib/periodo';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { DespesaPessoal } from '@/types/despesa';
import type { PeriodoFiltro } from '@/types/simulacao';

export default function DespesasPessoaisPage() {
  const { safraId, safra } = useSafraAtiva();
  const navigate = useNavigate();

  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState<PeriodoPersonalizado | null>(null);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPeriodoPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPeriodoPersonalizado(valor: PeriodoPersonalizado | null) {
    setPeriodoPersonalizado(valor);
    setPeriodo(valor ? null : 'dia');
  }

  useEffect(() => {
    setCarregando(true);
    listarDespesasPessoaisRequest(safraId)
      .then((res) => setDespesas(res.despesasPessoais))
      .catch(() => setErro('Não foi possível carregar suas despesas pessoais'))
      .finally(() => setCarregando(false));
  }, [safraId]);

  const despesasDoPeriodo = useMemo(
    () =>
      despesas.filter((d) =>
        periodoPersonalizado
          ? dataEstaNoIntervalo(d.data, periodoPersonalizado.dataInicio, periodoPersonalizado.dataFim)
          : dataEstaNoPeriodo(d.data, periodo ?? 'dia')
      ),
    [despesas, periodo, periodoPersonalizado]
  );

  const totalPeriodo = despesasDoPeriodo.reduce((acc, d) => acc + Number(d.valor), 0);

  const grupos = useMemo(() => {
    const porDia = new Map<string, DespesaPessoal[]>();
    for (const d of despesasDoPeriodo) {
      const chave = d.data.slice(0, 10);
      if (!porDia.has(chave)) porDia.set(chave, []);
      porDia.get(chave)!.push(d);
    }
    return [...porDia.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [despesasDoPeriodo]);

  return (
    <div>
      <Topbar />

      <div className="mx-auto flex max-w-sm flex-col gap-[18px] px-[22px] pb-6 pt-3.5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-rounded text-[20px] font-extrabold text-hf-stone-900">Despesas pessoais</h2>
            <p className="mt-0.5 text-[12.5px] text-hf-stone-600">Privado · {safra.nome}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/safras/${safraId}/despesas-pessoais/nova`)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-hf-green-800 py-4 text-[14.5px] font-bold text-white"
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2.4} />
          Nova despesa pessoal
        </button>

        <div className="flex flex-col gap-2">
          <PeriodToggle value={periodo} onChange={selecionarPeriodo} />
          <PeriodoPersonalizadoButton value={periodoPersonalizado} onChange={selecionarPeriodoPersonalizado} />
        </div>

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <div className="flex items-start gap-2.5 rounded-2xl bg-hf-green-100 px-4 py-3.5">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0 text-hf-green-700"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <p className="m-0 text-[12.5px] font-bold text-hf-stone-900">Só você vê essas despesas</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-hf-stone-600">
              Não entram na divisão de lucro nem no extrato da sociedade
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-hf-cream-100 px-4 py-3.5">
          <div>
            <p className="m-0 mb-0.5 text-xs text-hf-stone-600">Total de despesas pessoais no período</p>
            <span className="text-[11px] text-hf-stone-400">
              {despesasDoPeriodo.length} lançamento{despesasDoPeriodo.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="m-0 text-[19px] font-extrabold tabular-nums text-hf-red">{formatarMoeda(totalPeriodo)}</p>
        </div>

        {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}
        {!carregando && despesasDoPeriodo.length === 0 && (
          <p className="text-center text-sm text-hf-stone-600">Nenhuma despesa pessoal neste período.</p>
        )}

        {grupos.map(([dataChave, itens]) => (
          <div key={dataChave}>
            <div className="mb-0.5 text-[11.5px] font-bold uppercase tracking-wide text-hf-stone-400">
              {rotuloDia(dataChave, formatarData)}
            </div>
            <div>
              {itens.map((d) => {
                const Icone = ICONE_TIPO_DESPESA[d.tipo];
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => navigate(`/safras/${safraId}/despesas-pessoais/${d.id}/editar`)}
                    className="flex w-full items-center gap-3 border-b border-hf-cream-100 py-3 text-left last:border-b-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hf-red-bg">
                      <Icone className="h-[18px] w-[18px] text-hf-red" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-bold text-hf-stone-900">{ROTULO_TIPO_DESPESA[d.tipo]}</p>
                      {d.descricao && (
                        <p className="m-0 mt-0.5 truncate text-xs text-hf-stone-600">{d.descricao}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14.5px] font-extrabold tabular-nums text-hf-red">
                        {formatarMoeda(Number(d.valor))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
