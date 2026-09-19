import { useState } from 'react';
import type { DashboardAdmin } from '@/types/adminDashboard';
import { brl, brlEixo, maximoDoEixo, nomeDoMes } from './formatos';
import { useLargura } from './useLargura';

// Receita por mês em barras (uma série só, então sem legenda). Só a barra do mês corrente
// recebe o valor escrito; o resto aparece ao passar o mouse/tocar, pra não poluir.
export default function GraficoReceita({ dados }: { dados: DashboardAdmin['receitaPorMes'] }) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [dica, setDica] = useState<{ i: number; x: number; y: number } | null>(null);

  const h = w < 560 ? 240 : 320;
  const E = 56, D = 8, T = 24, B = 28;
  const largura = w - E - D;
  const altura = h - T - B;
  const maximo = maximoDoEixo(Math.max(...dados.map((m) => m.valor)));
  const faixa = largura / dados.length;
  const larguraBarra = Math.min(52, faixa * 0.55);
  const y = (v: number) => T + altura - (v / maximo) * altura;

  return (
    <div ref={ref} className="relative">
      <svg width={w} height={h} role="img" aria-label="Receita mensal dos últimos 5 meses" className="block overflow-visible">
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (maximo / 4) * t;
          return (
            <g key={t}>
              <line x1={E} x2={w - D} y1={y(v)} y2={y(v)} stroke="#e6eae2" />
              <text x={E - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5c6b5e">{brlEixo(v)}</text>
            </g>
          );
        })}
        {dados.map((m, i) => {
          const cx = E + faixa * i + faixa / 2;
          const topo = y(m.valor);
          const atual = i === dados.length - 1;
          const r = 4;
          return (
            <g key={m.mes}>
              {m.valor > 0 && (
                <path
                  d={`M${cx - larguraBarra / 2} ${T + altura}V${topo + r}Q${cx - larguraBarra / 2} ${topo} ${cx - larguraBarra / 2 + r} ${topo}H${cx + larguraBarra / 2 - r}Q${cx + larguraBarra / 2} ${topo} ${cx + larguraBarra / 2} ${topo + r}V${T + altura}Z`}
                  fill="#1e6b3e"
                />
              )}
              {atual && (
                <text x={cx} y={topo - 7} textAnchor="middle" fontSize="12" fontWeight="700" fill="#202821">{brl(m.valor)}</text>
              )}
              <text x={cx} y={h - 8} textAnchor="middle" fontSize="11" fill="#5c6b5e">{nomeDoMes(m.mes)}{atual ? ' (em andamento)' : ''}</text>
              <rect
                x={cx - faixa / 2}
                y={T}
                width={faixa}
                height={altura + B}
                fill="transparent"
                onPointerEnter={() => setDica({ i, x: cx, y: topo })}
                onPointerMove={() => setDica({ i, x: cx, y: topo })}
                onPointerLeave={() => setDica(null)}
              />
            </g>
          );
        })}
      </svg>
      {dica && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-hf-stone-900 px-2.5 py-1.5 text-auxiliar text-white shadow-lg"
          style={{ left: Math.min(Math.max(dica.x, 70), w - 70), top: dica.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <b className="block">{nomeDoMes(dados[dica.i].mes)}</b>
          {brl(dados[dica.i].valor)} · {dados[dica.i].pagamentos} {dados[dica.i].pagamentos === 1 ? 'pagamento' : 'pagamentos'}
        </div>
      )}
    </div>
  );
}
