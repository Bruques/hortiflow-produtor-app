import type { DashboardAdmin } from '@/types/adminDashboard';

// Onde os produtores ficam pelo caminho: cadastro → onboarding → plano → pagamento.
export default function Funil({ funil }: { funil: DashboardAdmin['funil'] }) {
  const total = funil.cadastraram;
  const passos: [string, number][] = [
    ['Cadastraram', funil.cadastraram],
    ['Responderam o onboarding', funil.responderamOnboarding],
    ['Escolheram um plano', funil.escolheramPlano],
    ['Pagaram', funil.pagaram],
  ];

  return (
    <div className="flex flex-col gap-3">
      {passos.map(([rotulo, n], i) => {
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const anterior = i > 0 && passos[i - 1][1] > 0 ? Math.round((n / passos[i - 1][1]) * 100) : null;
        return (
          <div key={rotulo}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-textoPequeno">
              <b className="font-bold text-hf-stone-900">{rotulo}</b>
              <span className="text-auxiliar tabular-nums text-hf-stone-400">
                {n} · {pct}%{anterior !== null && ` · ${anterior}% do passo anterior`}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-hf-cream-100">
              <div className="h-full rounded-full bg-hf-green-700 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
