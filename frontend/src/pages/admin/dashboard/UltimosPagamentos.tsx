import type { DashboardAdmin } from '@/types/adminDashboard';
import { brl, data, dataCurta, ROTULO_METODO } from './formatos';

export default function UltimosPagamentos({ pagamentos, onAbrir }: { pagamentos: DashboardAdmin['ultimosPagamentos']; onAbrir: (id: string) => void }) {
  if (pagamentos.length === 0) return <p className="m-0 text-corpo text-hf-stone-600">Nenhum pagamento ainda.</p>;

  return (
    <ul className="m-0 list-none p-0">
      {pagamentos.map((p, i) => (
        <li key={`${p.usuarioId}-${p.data}-${i}`} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 border-t border-hf-line/60 py-2.5 first:border-t-0 first:pt-0.5">
          <div className="min-w-0">
            <button type="button" onClick={() => onAbrir(p.usuarioId)} className="border-0 bg-transparent p-0 text-left text-corpo font-semibold text-hf-stone-900 hover:underline">
              {p.nome}
            </button>
            <div className="text-legenda text-hf-stone-600">
              {p.plano ? `${p.plano} · ` : ''}
              {ROTULO_METODO[p.metodo]} · cobre até {data(p.periodoFim)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-corpo font-bold tabular-nums text-hf-stone-900">{p.valor > 0 ? brl(p.valor) : 'Cortesia'}</div>
            <div className="text-auxiliar text-hf-stone-400">{dataCurta(p.data)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
