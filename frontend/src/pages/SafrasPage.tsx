import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, Sprout } from 'lucide-react';
import { encerrarSafraRequest, listarSafrasRequest } from '@/services/safras';
import { listarSociedadesRequest } from '@/services/sociedades';
import { ROTULO_STATUS_SAFRA } from '@/lib/rotulos';
import { cn, formatarData } from '@/lib/utils';
import type { Safra } from '@/types/safra';

// Acessada em Menu → "Abrir nova safra". Cada card leva direto pro Resumo da safra (mesmo
// padrão de card já usado na Início pós-login quando o usuário tem mais de uma safra) —
// a versão antiga abria um card cheio de atalhos (Despesas/Vendas/Acertos/...) por safra,
// redundante com a bottom nav de dentro dela.
export default function SafrasPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [nomeSociedade, setNomeSociedade] = useState<string | null>(null);
  const [safras, setSafras] = useState<Safra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);

  function carregar() {
    if (!sociedadeId) return;
    setCarregando(true);
    listarSafrasRequest(sociedadeId)
      .then((data) => setSafras(data.safras))
      .catch(() => setErro('Não foi possível carregar as safras'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [sociedadeId]);

  useEffect(() => {
    if (!sociedadeId) return;
    listarSociedadesRequest()
      .then((res) => {
        const minha = res.sociedades.find((s) => s.id === sociedadeId);
        setNomeSociedade(minha?.nome ?? null);
      })
      .catch(() => {});
  }, [sociedadeId]);

  async function encerrar(safraId: string) {
    setErro(null);
    setEncerrandoId(safraId);
    try {
      await encerrarSafraRequest(safraId);
      carregar();
    } catch {
      setErro('Não foi possível encerrar a safra');
    } finally {
      setEncerrandoId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(`/sociedades/${sociedadeId}/configuracoes`)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Safras</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-[22px] py-[14px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        {nomeSociedade && (
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-hf-stone-600">
            {nomeSociedade}
          </h3>
        )}

        {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}
        {!carregando && safras.length === 0 && (
          <p className="text-center text-sm text-hf-stone-600">Nenhuma safra ainda.</p>
        )}

        <div className="flex flex-col gap-2.5">
          {safras.map((s) => {
            const encerrada = s.status === 'ENCERRADA';
            return (
              <div key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/safras/${s.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-hf-line bg-white p-3.5 text-left"
                >
                  <div
                    className={cn(
                      'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl',
                      encerrada ? 'bg-hf-cream-100 text-hf-stone-400' : 'bg-hf-green-100 text-hf-green-700',
                    )}
                  >
                    <Sprout className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-bold text-hf-stone-900">{s.nome}</p>
                    <p className="mt-0.5 text-[11.5px] text-hf-stone-600">
                      {s.data_inicio && s.data_fim
                        ? `${formatarData(s.data_inicio)} – ${formatarData(s.data_fim)}`
                        : s.data_inicio
                          ? `Aberta em ${formatarData(s.data_inicio)}`
                          : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide',
                      encerrada ? 'bg-hf-cream-100 text-hf-stone-600' : 'bg-hf-green-100 text-hf-green-700',
                    )}
                  >
                    {ROTULO_STATUS_SAFRA[s.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-hf-stone-400" />
                </button>

                {s.status === 'EM_ANDAMENTO' && (
                  <button
                    type="button"
                    onClick={() => encerrar(s.id)}
                    disabled={encerrandoId === s.id}
                    className="mt-2 text-[12px] font-bold text-hf-stone-600 underline underline-offset-2 disabled:opacity-50"
                  >
                    {encerrandoId === s.id ? 'Encerrando...' : 'Encerrar esta safra'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={() => navigate(`/sociedades/${sociedadeId}/safras/nova`)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white"
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2.3} />
          Nova safra
        </button>
      </div>
    </div>
  );
}
