// docs/specs/21-relatorio-completo.md — dashboard de leitura do período, acessível a
// qualquer sócio (financiador ou meeiro), diferente do PDF (RelatorioPage.tsx), que é
// documento formal restrito a quem banca a produção.
import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Wallet, TrendingUp, Package, PieChart } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { PeriodToggle } from '@/components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '@/components/PeriodoAvancadoButton';
import { useSafraAtiva } from '@/lib/SafraContext';
import { buscarRelatorioCompletoRequest, buscarRelatorioCompletoPersonalizadoRequest } from '@/services/simulacao';
import { formatarMoeda } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import type { PeriodoFiltro, RelatorioCompleto } from '@/types/simulacao';

export default function RelatorioCompletoPage() {
  const { safraId } = useSafraAtiva();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('mes');
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState<PeriodoPersonalizado | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioCompleto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPeriodoPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPeriodoPersonalizado(valor: PeriodoPersonalizado | null) {
    setPeriodoPersonalizado(valor);
    setPeriodo(valor ? null : 'mes');
  }

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    const requisicao = periodoPersonalizado
      ? buscarRelatorioCompletoPersonalizadoRequest(safraId, periodoPersonalizado.dataInicio, periodoPersonalizado.dataFim)
      : buscarRelatorioCompletoRequest(safraId, periodo ?? 'mes');
    requisicao
      .then(setRelatorio)
      .catch(() => setErro('Não foi possível carregar o relatório'))
      .finally(() => setCarregando(false));
  }, [safraId, periodo, periodoPersonalizado]);

  const maiorCategoria = useMemo(
    () => Math.max(1, ...(relatorio?.despesasPorCategoria.map((c) => c.valor) ?? [1])),
    [relatorio]
  );

  return (
    <div>
      <Topbar />

      <div className="mx-auto flex max-w-sm flex-col gap-[22px] px-[22px] pb-6 pt-3.5">
        <h1 className="font-rounded text-tituloTela font-extrabold text-hf-stone-900">Relatório completo</h1>

        <div className="flex gap-2">
          <PeriodToggle value={periodo} onChange={selecionarPeriodo} incluirSafra={false} />
          <PeriodoAvancadoButton
            periodo={periodo}
            periodoPersonalizado={periodoPersonalizado}
            onSelecionarPeriodo={selecionarPeriodo}
            onSelecionarPeriodoPersonalizado={selecionarPeriodoPersonalizado}
          />
        </div>

        {erro && <p className="text-center text-corpo font-medium text-hf-red">{erro}</p>}

        {carregando && !relatorio && <p className="text-center text-corpo text-hf-stone-600">Calculando...</p>}

        {relatorio && (
          <>
            <div>
              <h3 className="mb-2.5 text-tituloSecao font-extrabold text-hf-stone-900">Resumo do período</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-hf-blue-bg">
                    <ShoppingCart className="h-[17px] w-[17px] text-hf-blue" />
                  </div>
                  <span className="text-auxiliar text-hf-stone-600">Receita (Vendas)</span>
                  <span className="-mt-1.5 text-valorDestaque font-extrabold tabular-nums">{formatarMoeda(relatorio.receita)}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-hf-red-bg">
                    <Wallet className="h-[17px] w-[17px] text-hf-red" />
                  </div>
                  <span className="text-auxiliar text-hf-stone-600">Despesas</span>
                  <span className="-mt-1.5 text-valorDestaque font-extrabold tabular-nums">{formatarMoeda(relatorio.despesas)}</span>
                </div>
                <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-hf-green-100">
                    <TrendingUp className="h-[17px] w-[17px] text-hf-green-600" />
                  </div>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-auxiliar text-hf-stone-600">Lucro líquido</span>
                    <span
                      className={
                        'text-valorDestaque font-extrabold tabular-nums ' +
                        (relatorio.lucroLiquido < 0 ? 'text-hf-red' : '')
                      }
                    >
                      {formatarMoeda(relatorio.lucroLiquido)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 text-tituloSecao font-extrabold text-hf-stone-900">Divisão do lucro</h3>
              <div>
                {relatorio.divisao.length === 0 && (
                  <p className="text-center text-corpo text-hf-stone-600">Sem lançamentos neste período.</p>
                )}
                {relatorio.divisao.map((d) => (
                  <div
                    key={d.socio_id}
                    className="flex items-center justify-between border-b border-hf-cream-100 py-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <span className="text-corpo font-bold text-hf-stone-900">{d.nome}</span>
                      <div className="mt-0.5 text-etiqueta text-hf-stone-400">Percentual: {d.percentual}%</div>
                    </div>
                    <div className={'text-valorSecundario font-extrabold tabular-nums ' + (d.valor < 0 ? 'text-hf-red' : '')}>
                      {formatarMoeda(d.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 flex items-center gap-2 text-tituloSecao font-extrabold text-hf-stone-900">
                <Package className="h-4 w-4 text-hf-blue" />
                Vendas por unidade
              </h3>
              <div>
                {relatorio.quantidadePorUnidade.length === 0 && (
                  <p className="text-center text-corpo text-hf-stone-600">Nenhuma venda neste período.</p>
                )}
                {relatorio.quantidadePorUnidade.map((q) => {
                  const media = relatorio.mediaPrecoPorUnidade.find((m) => m.unidade_id === q.unidade_id);
                  return (
                    <div
                      key={q.unidade_id}
                      className="flex items-center justify-between border-b border-hf-cream-100 py-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <span className="text-corpo font-bold text-hf-stone-900">{q.unidade_nome}</span>
                        <div className="mt-0.5 text-etiqueta text-hf-stone-400">{q.quantidade} vendidas</div>
                      </div>
                      <div className="text-right">
                        <div className="text-valorSecundario font-extrabold tabular-nums text-hf-green-800">
                          {formatarMoeda(media?.media_preco ?? 0)}
                        </div>
                        <div className="text-miniLegenda text-hf-stone-400">Preço médio</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 flex items-center gap-2 text-tituloSecao font-extrabold text-hf-stone-900">
                <PieChart className="h-4 w-4 text-hf-amber" />
                Despesas por categoria
              </h3>
              <div>
                {relatorio.despesasPorCategoria.length === 0 && (
                  <p className="text-center text-corpo text-hf-stone-600">Nenhuma despesa neste período.</p>
                )}
                {relatorio.despesasPorCategoria
                  .slice()
                  .sort((a, b) => b.valor - a.valor)
                  .map((c) => (
                    <div key={c.tipo} className="py-2">
                      <div className="mb-1 flex items-center justify-between text-corpo">
                        <span className="font-bold text-hf-stone-900">{ROTULO_TIPO_DESPESA[c.tipo]}</span>
                        <span className="tabular-nums text-hf-stone-600">
                          {formatarMoeda(c.valor)} ({c.percentual.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-hf-cream-100">
                        <div
                          className="h-full rounded-full bg-hf-amber"
                          style={{ width: `${(c.valor / maiorCategoria) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
