import { cn } from '@/lib/utils';
import type { DashboardAdmin, TipoAtencao } from '@/types/adminDashboard';
import { linkWhatsApp } from './formatos';

const LIMITE_VISIVEL = 6;

const ICONE: Record<TipoAtencao, { simbolo: string; classe: string }> = {
  ACESSO_VENCIDO: { simbolo: '!', classe: 'bg-hf-red-bg text-[#9c2727]' },
  RENOVACAO_MANUAL: { simbolo: '↻', classe: 'bg-hf-amber-bg text-[#7a5000]' },
  TRIAL_ACABANDO: { simbolo: '⏳', classe: 'bg-hf-amber-bg text-[#7a5000]' },
  ONBOARDING_PARADO: { simbolo: '?', classe: 'bg-hf-blue-bg text-hf-blue' },
};

interface Props {
  itens: DashboardAdmin['atencao'];
  produtores: DashboardAdmin['produtores'];
  onAbrir: (usuarioId: string) => void;
}

export default function ListaAtencao({ itens, produtores, onAbrir }: Props) {
  if (itens.length === 0) return <p className="m-0 text-corpo text-hf-stone-600">Tudo em dia por aqui.</p>;
  const porId = new Map(produtores.map((p) => [p.usuarioId, p]));

  return (
    <>
      <ul className="m-0 flex list-none flex-col p-0">
        {itens.slice(0, LIMITE_VISIVEL).map((item) => {
          const produtor = porId.get(item.usuarioId);
          return (
            <li key={`${item.usuarioId}-${item.tipo}`} className="flex items-center gap-2.5 border-t border-hf-line/60 py-2.5 first:border-t-0 first:pt-0.5">
              <span className={cn('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] text-corpo font-extrabold', ICONE[item.tipo].classe)} aria-hidden="true">
                {ICONE[item.tipo].simbolo}
              </span>
              <button type="button" onClick={() => onAbrir(item.usuarioId)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left">
                <strong className="block text-corpo font-semibold text-hf-stone-900">{produtor?.nome ?? 'Produtor'}</strong>
                <span className="block text-legenda text-hf-stone-600">
                  {item.titulo} · {item.detalhe}
                </span>
              </button>
              {produtor && (
                <a
                  href={linkWhatsApp(produtor.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-[10px] border border-hf-line bg-white px-2.5 py-1.5 text-legenda font-semibold text-hf-stone-900"
                >
                  WhatsApp
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {itens.length > LIMITE_VISIVEL && <p className="mb-0 mt-2 text-legenda text-hf-stone-400">+ {itens.length - LIMITE_VISIVEL} outros casos</p>}
    </>
  );
}
