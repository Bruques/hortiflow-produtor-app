import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ProdutorDashboard, SituacaoProdutor } from '@/types/adminDashboard';
import { brl, data, prazoDoAcesso } from './formatos';
import Pilula from './Pilula';

const FILTROS: { id: string; rotulo: string; aceita: (s: SituacaoProdutor) => boolean }[] = [
  { id: 'todos', rotulo: 'Todos', aceita: () => true },
  { id: 'ativos', rotulo: 'Ativos', aceita: (s) => s === 'ATIVA' },
  { id: 'trial', rotulo: 'Em trial', aceita: (s) => s === 'EM_TRIAL' },
  { id: 'vencidos', rotulo: 'Vencidos', aceita: (s) => s === 'VENCIDA' || s === 'TRIAL_EXPIRADO' },
  { id: 'fora', rotulo: 'Cancelados e bloqueados', aceita: (s) => s === 'CANCELADA' || s === 'BLOQUEADA' },
];

const TOM_PRAZO = { atrasado: 'font-semibold text-[#9c2727]', perto: 'font-semibold text-[#7a5000]', normal: 'text-hf-stone-400' };

export default function TabelaProdutores({ produtores, onAbrir }: { produtores: ProdutorDashboard[]; onAbrir: (id: string) => void }) {
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const aceita = FILTROS.find((f) => f.id === filtro)!.aceita;
    const q = busca.trim().toLowerCase();
    const digitos = q.replace(/\D/g, '');
    return produtores.filter((p) => {
      if (!aceita(p.situacao)) return false;
      if (!q) return true;
      return p.nome.toLowerCase().includes(q) || (digitos !== '' && p.telefone.replace(/\D/g, '').includes(digitos));
    });
  }, [produtores, filtro, busca]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar produtor"
          className="h-10 min-w-0 flex-[1_1_220px] rounded-[10px] border border-hf-line bg-hf-cream-50 px-3 text-corpo outline-none focus:border-hf-green-500"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
          {FILTROS.map((f) => {
            const n = produtores.filter((p) => f.aceita(p.situacao)).length;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-legenda font-semibold',
                  filtro === f.id ? 'border-hf-green-700 bg-hf-green-700 text-white' : 'border-hf-line bg-white text-hf-stone-600'
                )}
              >
                {f.rotulo} <span className="font-medium tabular-nums opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[860px] border-collapse text-corpo">
          <thead>
            <tr>
              {['Produtor', 'Situação', 'Plano', 'Acesso até', 'Total pago', 'Lavouras', 'Cadastro'].map((titulo, i) => (
                <th
                  key={titulo}
                  className={cn('whitespace-nowrap border-b border-hf-line px-2.5 py-2 text-left text-etiqueta font-semibold uppercase tracking-wider text-hf-stone-400', (i === 4 || i === 5) && 'text-right')}
                >
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const prazo = prazoDoAcesso(p.dataFimAcesso);
              return (
                <tr key={p.usuarioId} onClick={() => onAbrir(p.usuarioId)} className="cursor-pointer hover:bg-hf-cream-50">
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrir(p.usuarioId);
                      }}
                      className="border-0 bg-transparent p-0 text-left font-semibold text-hf-stone-900 hover:underline"
                    >
                      {p.nome}
                    </button>
                    <span className="block text-auxiliar text-hf-stone-400">{p.telefone}</span>
                  </td>
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5"><Pilula situacao={p.situacao} /></td>
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5">
                    {p.plano ? `${p.plano.nome}${p.ciclo ? ` · ${p.ciclo.toLowerCase()}` : ''}` : <span className="text-hf-stone-400">sem plano</span>}
                  </td>
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5 tabular-nums">
                    {p.dataFimAcesso ? data(p.dataFimAcesso) : '—'}
                    <small className={cn('block text-auxiliar', TOM_PRAZO[prazo.tom])}>{prazo.texto}</small>
                  </td>
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5 text-right tabular-nums">{p.totalPago > 0 ? brl(p.totalPago) : '—'}</td>
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5 text-right tabular-nums">
                    {p.limiteSafras === null ? p.safrasAtivas : `${p.safrasAtivas} / ${p.limiteSafras}`}
                  </td>
                  <td className="border-b border-hf-line/60 px-2.5 py-2.5 tabular-nums">{data(p.criadoEm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lista.length === 0 && <p className="py-7 text-center text-corpo text-hf-stone-400">Nenhum produtor com esse filtro.</p>}
    </div>
  );
}
