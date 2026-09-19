import { useState } from 'react';
import type { DashboardAdmin } from '@/types/adminDashboard';
import { dataCurta, nomeDoMes } from './formatos';
import { useLargura } from './useLargura';

const COR_CADASTRADOS = '#5f84ad';
const COR_PAGANTES = '#1e6b3e';

// Duas linhas acumuladas (cadastrados e pagantes) por semana. Cores diferentes em matiz e em
// luminosidade, mais legenda no cabeçalho do painel e valor escrito na ponta de cada linha,
// pra a identidade nunca depender só da cor.
export default function GraficoCrescimento({ dados }: { dados: DashboardAdmin['crescimentoSemanal'] }) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);

  const h = 250;
  const E = 30, D = 30, T = 14, B = 26;
  const largura = w - E - D;
  const altura = h - T - B;
  const n = dados.length;
  const maximo = Math.max(4, Math.ceil(Math.max(...dados.map((p) => p.cadastrados)) / 4) * 4);
  const x = (i: number) => E + (largura * i) / Math.max(1, n - 1);
  const y = (v: number) => T + altura - (v / maximo) * altura;
  const linha = (chave: 'cadastrados' | 'pagantes') =>
    dados.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[chave]).toFixed(1)}`).join('');
  const ultimo = dados[n - 1];

  // Rótulo de mês no primeiro ponto de cada mês (o primeiro do gráfico incluído).
  const rotulosMes = dados
    .map((p, i) => ({ i, mes: p.semana.slice(0, 7) }))
    .filter((p, k, todos) => k === 0 || p.mes !== todos[k - 1].mes);

  return (
    <div ref={ref} className="relative">
      <svg width={w} height={h} role="img" aria-label="Cadastrados e pagantes acumulados por semana" className="block overflow-visible">
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (maximo / 4) * t;
          return (
            <g key={t}>
              <line x1={E} x2={w - D} y1={y(v)} y2={y(v)} stroke="#e6eae2" />
              <text x={E - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5c6b5e">{v}</text>
            </g>
          );
        })}
        {rotulosMes.map((r) => (
          <text key={r.mes} x={x(r.i)} y={h - 8} textAnchor={r.i === 0 ? 'start' : 'middle'} fontSize="11" fill="#5c6b5e">{nomeDoMes(r.mes)}</text>
        ))}
        <path d={`${linha('cadastrados')}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} fill={COR_CADASTRADOS} opacity="0.12" />
        <path d={linha('cadastrados')} fill="none" stroke={COR_CADASTRADOS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linha('pagantes')} fill="none" stroke={COR_PAGANTES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {(['cadastrados', 'pagantes'] as const).map((chave) => (
          <g key={chave}>
            <circle cx={x(n - 1)} cy={y(ultimo[chave])} r="4" fill={chave === 'pagantes' ? COR_PAGANTES : COR_CADASTRADOS} stroke="#fff" strokeWidth="2" />
            <text x={x(n - 1) + 9} y={y(ultimo[chave]) + 4} fontSize="12" fontWeight="700" fill="#202821">{ultimo[chave]}</text>
          </g>
        ))}
        {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={T + altura} stroke="#96a092" strokeDasharray="3 3" />}
        <rect
          x={E}
          y={T}
          width={largura}
          height={altura}
          fill="transparent"
          onPointerMove={(e) => {
            const caixa = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - caixa.left) / caixa.width) * (n - 1));
            setAtivo(Math.max(0, Math.min(n - 1, i)));
          }}
          onPointerLeave={() => setAtivo(null)}
        />
      </svg>
      {ativo !== null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-hf-stone-900 px-2.5 py-1.5 text-auxiliar text-white shadow-lg"
          style={{ left: Math.min(Math.max(x(ativo), 80), w - 80), top: y(dados[ativo].cadastrados) - 8, transform: 'translate(-50%, -100%)' }}
        >
          <b className="block">Semana de {dataCurta(`${dados[ativo].semana}T12:00:00-03:00`)}</b>
          {dados[ativo].cadastrados} cadastrados · {dados[ativo].pagantes} pagaram
        </div>
      )}
    </div>
  );
}
