import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Check } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { PeriodToggle } from '@/components/PeriodToggle';
import { PeriodoPersonalizadoButton, type PeriodoPersonalizado } from '@/components/PeriodoPersonalizadoButton';
import { useSafraAtiva } from '@/lib/SafraContext';
import { listarVendasRequest, type FiltroVendas } from '@/services/vendas';
import { listarRegrasRequest } from '@/services/regrasDespesaRecorrente';
import { cn, formatarData, formatarMoeda } from '@/lib/utils';
import { rotuloDia } from '@/lib/periodo';
import type { Venda } from '@/types/venda';
import type { PeriodoFiltro } from '@/types/simulacao';

export default function VendasPage() {
  const { safraId, sociedadeId, safra } = useSafraAtiva();
  const navigate = useNavigate();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState<PeriodoPersonalizado | null>(null);
  const [statusPagamento, setStatusPagamento] = useState<'todas' | 'pagas' | 'a_receber'>('todas');

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPeriodoPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPeriodoPersonalizado(valor: PeriodoPersonalizado | null) {
    setPeriodoPersonalizado(valor);
    setPeriodo(valor ? null : 'dia');
  }

  // Valor de cada RegraDespesaRecorrente por id — cruzado com `venda.regras_aplicadas` (as
  // regras que o sócio realmente deixou marcadas ao lançar/editar essa venda específica, ver
  // adendo 2026-07-22 da spec 04) pra calcular o selo "gerou despesa automática". Usar o estado
  // atual (ativo/inativo) da regra aqui seria errado: mudar uma regra em Configurações não pode
  // mudar retroativamente a tag de vendas já lançadas.
  const [valorPorRegraId, setValorPorRegraId] = useState<Record<string, number>>({});

  // Filtro enviado pro backend já resolver a query no banco (where: { data: { gte, lte }, pago })
  // em vez de trazer a safra inteira e filtrar em memória — evita o custo de memória/rede
  // que cresce junto com o acúmulo de lançamentos ao longo da safra.
  const filtro: FiltroVendas = useMemo(
    () => ({
      ...(periodoPersonalizado
        ? { data_inicio: periodoPersonalizado.dataInicio, data_fim: periodoPersonalizado.dataFim }
        : { periodo: periodo ?? 'dia' }),
      ...(statusPagamento !== 'todas' ? { pago: statusPagamento === 'pagas' } : {}),
    }),
    [periodo, periodoPersonalizado, statusPagamento]
  );

  useEffect(() => {
    setCarregando(true);
    listarVendasRequest(safraId, filtro)
      .then((res) => setVendas(res.vendas))
      .catch(() => setErro('Não foi possível carregar as vendas'))
      .finally(() => setCarregando(false));
  }, [safraId, filtro]);

  useEffect(() => {
    listarRegrasRequest(sociedadeId)
      .then((res) => {
        const porId: Record<string, number> = {};
        res.regras.forEach((r) => {
          porId[r.id] = Number(r.valor);
        });
        setValorPorRegraId(porId);
      })
      .catch(() => {});
  }, [sociedadeId]);

  const vendasDoPeriodo = vendas;

  const totalPeriodo = vendasDoPeriodo.reduce((acc, v) => acc + Number(v.total), 0);

  const quantidadePorUnidadePeriodo = useMemo(() => {
    const porUnidade = new Map<string, number>();
    for (const v of vendasDoPeriodo) {
      porUnidade.set(v.unidade_nome, (porUnidade.get(v.unidade_nome) ?? 0) + Number(v.quantidade));
    }
    return [...porUnidade.entries()];
  }, [vendasDoPeriodo]);

  const grupos = useMemo(() => {
    const porDia = new Map<string, Venda[]>();
    for (const v of vendasDoPeriodo) {
      const chave = v.data.slice(0, 10);
      if (!porDia.has(chave)) porDia.set(chave, []);
      porDia.get(chave)!.push(v);
    }
    return [...porDia.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [vendasDoPeriodo]);

  return (
    <div>
      <Topbar />

      <div className="mx-auto flex max-w-sm flex-col gap-[18px] px-[22px] pb-6 pt-3.5">
        <div>
          <h2 className="font-rounded text-[20px] font-extrabold text-hf-stone-900">Vendas</h2>
          <p className="mt-0.5 text-[12.5px] text-hf-stone-600">{safra.nome}</p>
        </div>

        <div className="flex flex-col gap-2">
          <PeriodToggle value={periodo} onChange={selecionarPeriodo} />
          <PeriodoPersonalizadoButton value={periodoPersonalizado} onChange={selecionarPeriodoPersonalizado} />
        </div>

        <div role="tablist" aria-label="Status de pagamento" className="flex gap-0.5 rounded-xl bg-hf-cream-100 p-1">
          {(
            [
              { valor: 'todas', label: 'Todas' },
              { valor: 'pagas', label: 'Pagas' },
              { valor: 'a_receber', label: 'A receber' },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              role="tab"
              aria-selected={statusPagamento === opcao.valor}
              onClick={() => setStatusPagamento(opcao.valor)}
              className={cn(
                'flex-1 rounded-lg py-2 text-[12.5px] font-bold transition-colors',
                statusPagamento === opcao.valor
                  ? 'bg-white text-hf-green-800 shadow-sm'
                  : 'text-hf-stone-600 hover:text-hf-stone-900'
              )}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <div className="flex items-center justify-between rounded-2xl bg-hf-cream-100 px-4 py-3.5">
          <div>
            <p className="m-0 mb-0.5 text-xs text-hf-stone-600">Total vendido no período</p>
            <span className="text-[11px] text-hf-stone-400">
              {quantidadePorUnidadePeriodo.map(([nome, qtd]) => `${qtd} ${nome}`).join(' · ') || '0'} ·{' '}
              {vendasDoPeriodo.length} lançamento{vendasDoPeriodo.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="m-0 text-[19px] font-extrabold tabular-nums text-hf-green-800">
            {formatarMoeda(totalPeriodo)}
          </p>
        </div>

        {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}
        {!carregando && vendasDoPeriodo.length === 0 && (
          <p className="text-center text-sm text-hf-stone-600">Nenhuma venda neste período.</p>
        )}

        {grupos.map(([dataChave, itens]) => (
          <div key={dataChave}>
            <div className="mb-0.5 text-[11.5px] font-bold uppercase tracking-wide text-hf-stone-400">
              {rotuloDia(dataChave, formatarData)}
            </div>
            <div>
              {itens.map((v) => {
                const valorAuto =
                  v.regras_aplicadas.reduce((acc, regraId) => acc + (valorPorRegraId[regraId] ?? 0), 0) *
                  Number(v.quantidade);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigate(`/safras/${safraId}/vendas/${v.id}/editar`)}
                    className="flex w-full items-center gap-3 border-b border-hf-cream-100 py-3 text-left last:border-b-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hf-blue-bg">
                      <ShoppingCart className="h-[18px] w-[18px] text-hf-blue" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-bold text-hf-stone-900">
                        {v.quantidade} {v.unidade_nome} × {formatarMoeda(Number(v.preco))}
                      </p>
                      {v.comprador && (
                        <div className="mt-0.5 text-xs text-hf-stone-600">Comprador: {v.comprador}</div>
                      )}
                      <div
                        className={cn(
                          'mt-1.5 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
                          v.pago ? 'bg-hf-green-100 text-hf-green-600' : 'bg-hf-cream-100 text-hf-stone-600'
                        )}
                      >
                        {v.pago ? 'Pago' : 'A receber'}
                      </div>
                      {valorAuto > 0 && (
                        <div className="mt-1.5 inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-hf-green-100 px-2 py-0.5 text-[10px] font-bold text-hf-green-600">
                          <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
                          gerou despesa automática de {formatarMoeda(valorAuto)}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14.5px] font-extrabold tabular-nums text-hf-green-800">
                        {formatarMoeda(Number(v.total))}
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
