import type { DashboardAdmin } from '@/types/adminDashboard';
import { brl, nomeDoMes } from './formatos';

const CARTAO = 'min-w-0 rounded-2xl border border-hf-line bg-white px-4 py-3.5';

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string | number; nota: string }) {
  return (
    <div className={CARTAO}>
      <div className="text-auxiliar font-semibold text-hf-stone-600">{rotulo}</div>
      <div className="mt-1.5 font-rounded text-hero font-extrabold tabular-nums leading-tight text-hf-stone-900">{valor}</div>
      <div className="mt-1 text-auxiliar text-hf-stone-400">{nota}</div>
    </div>
  );
}

export default function ResumoKpis({ resumo, mesAtual, mesAnterior }: { resumo: DashboardAdmin['resumo']; mesAtual: string; mesAnterior: string }) {
  const variacao =
    resumo.receitaMesAnterior > 0 ? Math.round(((resumo.receitaMes - resumo.receitaMesAnterior) / resumo.receitaMesAnterior) * 100) : null;

  return (
    <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <div className="col-span-2 min-w-0 rounded-2xl bg-gradient-to-br from-hf-green-800 to-hf-green-700 px-4 py-3.5 text-white">
        <div className="text-auxiliar font-semibold text-white/80">Receita em {nomeDoMes(mesAtual)}</div>
        <div className="mt-1.5 font-rounded text-[34px] font-extrabold tabular-nums leading-tight">{brl(resumo.receitaMes)}</div>
        <div className="mt-1 text-auxiliar text-white/80">
          {variacao !== null && (
            <span className="mr-1.5 inline-block rounded-full bg-white/15 px-2 py-px font-bold text-white">
              {variacao >= 0 ? '+' : ''}
              {variacao}%
            </span>
          )}
          {variacao !== null ? `vs. ${nomeDoMes(mesAnterior)} inteiro · ` : ''}
          {brl(resumo.receitaTotal)} desde o início
        </div>
        {resumo.receitaMesContasExcluidas > 0 && (
          <div className="mt-1 text-auxiliar text-white/80">
            Inclui {brl(resumo.receitaMesContasExcluidas)} de contas já excluídas, que não aparecem na lista de produtores
          </div>
        )}
      </div>
      <Cartao rotulo="Recorrência mensal" valor={brl(resumo.recorrenciaMensal)} nota="planos ativos, anuais ÷ 12" />
      <Cartao rotulo="Assinantes ativos" valor={resumo.ativos} nota="com acesso pago em dia" />
      <Cartao rotulo="Em trial" valor={resumo.emTrial} nota="ainda no período grátis" />
      <Cartao rotulo="Cadastrados" valor={resumo.cadastrados} nota={`+${resumo.cadastradosUltimos7Dias} nos últimos 7 dias`} />
    </section>
  );
}
