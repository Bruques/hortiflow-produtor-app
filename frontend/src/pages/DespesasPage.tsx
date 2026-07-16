import { useEffect, useMemo, useState } from 'react';
import { X, Receipt } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { PeriodToggle } from '@/components/PeriodToggle';
import { useSafraAtiva } from '@/lib/SafraContext';
import { listarDespesasRequest } from '@/services/despesas';
import { confirmarSugestaoRequest, listarSugestoesRequest } from '@/services/regrasDespesaRecorrente';
import { formatarData, formatarMoeda, iniciais } from '@/lib/utils';
import { dataEstaNoPeriodo, rotuloDia } from '@/lib/periodo';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { Despesa } from '@/types/despesa';
import type { PeriodoFiltro } from '@/types/simulacao';
import type { SugestaoDespesaRecorrente } from '@/types/regraDespesaRecorrente';

export default function DespesasPage() {
  const { safraId, safra } = useSafraAtiva();

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('semana');

  const [sugestoes, setSugestoes] = useState<SugestaoDespesaRecorrente[]>([]);
  const [sugestoesDispensadas, setSugestoesDispensadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCarregando(true);
    listarDespesasRequest(safraId)
      .then((res) => setDespesas(res.despesas))
      .catch(() => setErro('Não foi possível carregar as despesas'))
      .finally(() => setCarregando(false));
  }, [safraId]);

  useEffect(() => {
    listarSugestoesRequest(safraId)
      .then((res) => setSugestoes(res.sugestoes))
      .catch(() => setErro('Não foi possível carregar as sugestões do dia'));
  }, [safraId]);

  const despesasDoPeriodo = useMemo(
    () => despesas.filter((d) => dataEstaNoPeriodo(d.data, periodo)),
    [despesas, periodo]
  );

  const totalPeriodo = despesasDoPeriodo.reduce((acc, d) => acc + Number(d.valor), 0);

  const grupos = useMemo(() => {
    const porDia = new Map<string, Despesa[]>();
    for (const d of despesasDoPeriodo) {
      const chave = d.data.slice(0, 10);
      if (!porDia.has(chave)) porDia.set(chave, []);
      porDia.get(chave)!.push(d);
    }
    return [...porDia.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [despesasDoPeriodo]);

  const sugestoesVisiveis = sugestoes.filter((s) => !sugestoesDispensadas.has(s.id));

  async function confirmarSugestao(regraId: string) {
    setErro(null);
    try {
      await confirmarSugestaoRequest(safraId, regraId);
      const [resSugestoes, resDespesas] = await Promise.all([
        listarSugestoesRequest(safraId),
        listarDespesasRequest(safraId),
      ]);
      setSugestoes(resSugestoes.sugestoes);
      setDespesas(resDespesas.despesas);
    } catch {
      setErro('Não foi possível confirmar a sugestão');
    }
  }

  function dispensarSugestao(id: string) {
    setSugestoesDispensadas((atual) => new Set(atual).add(id));
  }

  return (
    <div>
      <Topbar safraId={safraId} />

      <div className="mx-auto flex max-w-sm flex-col gap-[18px] px-[22px] pb-6 pt-3.5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-rounded text-[20px] font-extrabold text-hf-stone-900">Despesas</h2>
            <p className="mt-0.5 text-[12.5px] text-hf-stone-600">Sociedade · {safra.nome}</p>
          </div>
        </div>

        <PeriodToggle value={periodo} onChange={setPeriodo} />

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <div className="flex items-center justify-between rounded-2xl bg-hf-cream-100 px-4 py-3.5">
          <div>
            <p className="m-0 mb-0.5 text-xs text-hf-stone-600">Total de despesas no período</p>
            <span className="text-[11px] text-hf-stone-400">
              {despesasDoPeriodo.length} lançamento{despesasDoPeriodo.length === 1 ? '' : 's'} · todos os sócios
            </span>
          </div>
          <p className="m-0 text-[19px] font-extrabold tabular-nums text-hf-red">{formatarMoeda(totalPeriodo)}</p>
        </div>

        {sugestoesVisiveis.map((s) => (
          <div key={s.id} className="relative flex items-start gap-3 rounded-2xl bg-hf-amber-bg p-3.5">
            <button
              type="button"
              aria-label="Dispensar sugestão"
              onClick={() => dispensarSugestao(s.id)}
              className="absolute right-2.5 top-2.5 p-0.5 text-hf-amber opacity-70"
            >
              <X className="h-[15px] w-[15px]" strokeWidth={2.2} />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/55">
              <Receipt className="h-[18px] w-[18px] text-hf-amber" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-extrabold text-[#5a3f0e]">
                {ROTULO_TIPO_DESPESA[s.tipo_despesa]} · {formatarMoeda(Number(s.valor))}
              </p>
              <p className="m-0 mb-2 mt-0.5 text-[11.5px] text-hf-amber">
                Regra recorrente de hoje — toque pra confirmar o lançamento
              </p>
              <button
                type="button"
                onClick={() => confirmarSugestao(s.id)}
                className="rounded-full bg-hf-green-700 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                Confirmar despesa
              </button>
            </div>
          </div>
        ))}

        {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}
        {!carregando && despesasDoPeriodo.length === 0 && (
          <p className="text-center text-sm text-hf-stone-600">Nenhuma despesa neste período.</p>
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
                  <div key={d.id} className="flex items-center gap-3 border-b border-hf-cream-100 py-3 last:border-b-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hf-red-bg">
                      <Icone className="h-[18px] w-[18px] text-hf-red" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-bold text-hf-stone-900">{ROTULO_TIPO_DESPESA[d.tipo]}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-hf-stone-600">
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-hf-green-100 text-[8.5px] font-extrabold text-hf-green-800">
                          {iniciais(d.socio_nome)}
                        </span>
                        {d.socio_nome}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14.5px] font-extrabold tabular-nums text-hf-red">
                        {formatarMoeda(Number(d.valor))}
                      </div>
                      {d.foto_comprovante && (
                        <div className="mt-0.5 text-[10.5px] text-hf-stone-400">comprovante</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
