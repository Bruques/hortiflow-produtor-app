import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { buscarAcertoRequest } from '@/services/acertos';
import { cn, formatarData, formatarMoeda, iniciais } from '@/lib/utils';
import type { AcertoDetalhado } from '@/types/acerto';

export default function AcertoDetalhePage() {
  const { id } = useParams<{ id: string }>(); // acerto id
  const navigate = useNavigate();

  const [acerto, setAcerto] = useState<AcertoDetalhado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    buscarAcertoRequest(id)
      .then(setAcerto)
      .catch(() => setErro('Não foi possível carregar o acerto'))
      .finally(() => setCarregando(false));
  }, [id]);

  function voltar() {
    // Rota explícita pra lista de Acertos da safra dona deste acerto, em vez de navigate(-1) —
    // mesma razão das telas Nova despesa/Nova venda: sem histórico prévio (link direto,
    // refresh), voltar por histórico trava a navegação.
    if (acerto) navigate(`/safras/${acerto.safra_id}/acertos`);
    else navigate(-1);
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={voltar}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Extrato do acerto</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}
        {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

        {acerto && (
          <>
            <div className="rounded-[18px] bg-gradient-to-br from-hf-green-800 to-hf-green-900 p-5 text-white">
              <span
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide',
                  acerto.tipo === 'FINAL' ? 'bg-white text-hf-green-800' : 'bg-white/20 text-white'
                )}
              >
                {acerto.tipo === 'FINAL' ? 'Final' : 'Parcial'}
              </span>
              <p className="m-0 mb-0.5 mt-2.5 text-[15px] font-extrabold">
                {formatarData(acerto.data_inicio)} – {formatarData(acerto.data_fim)}
              </p>
              <p className="m-0 text-[11.5px] opacity-80">Registrado em {formatarData(acerto.criado_em)}</p>
              <p className="m-0 mb-0.5 mt-3.5 text-xs opacity-80">Lucro líquido dividido no período</p>
              <p
                className={cn(
                  'm-0 text-[27px] font-extrabold tabular-nums',
                  acerto.lucroLiquido < 0 && 'text-red-300'
                )}
              >
                {formatarMoeda(acerto.lucroLiquido)}
              </p>
              <div className="mt-2.5 flex gap-4 text-[11.5px] opacity-85">
                <span>Receita: {formatarMoeda(acerto.receita)}</span>
                <span>Despesas: {formatarMoeda(acerto.despesas)}</span>
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 text-base font-extrabold text-hf-stone-900">Divisão por sócio</h3>
              <div className="flex flex-col gap-3">
                {acerto.socios.map((s) => (
                  <div key={s.socio_id} className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-hf-green-100 text-[13px] font-extrabold text-hf-green-800">
                          {iniciais(s.nome)}
                        </div>
                        <span className="text-sm font-bold text-hf-stone-900">{s.nome}</span>
                      </div>
                      <div className="text-right">
                        <div
                          className={cn(
                            'text-[16px] font-extrabold tabular-nums',
                            s.valor_lucro < 0 ? 'text-hf-red' : 'text-hf-green-800'
                          )}
                        >
                          {formatarMoeda(s.valor_lucro)}
                        </div>
                        <div className="text-[10px] text-hf-stone-400">Recebido</div>
                      </div>
                    </div>
                    <div className="flex gap-5 border-t border-dashed border-hf-cream-100 pt-2.5">
                      <div>
                        <div className="text-[10.5px] text-hf-stone-400">Despesas bancadas</div>
                        <div className="text-[13.5px] font-bold tabular-nums text-hf-stone-900">
                          {formatarMoeda(s.despesas_bancadas)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10.5px] text-hf-stone-400">Percentual aplicado</div>
                        <div className="text-[13.5px] font-bold tabular-nums text-hf-stone-900">
                          {s.percentual_aplicado}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-hf-cream-100 px-3.5 py-3.5">
              <ShieldCheck className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-stone-600" strokeWidth={2} />
              <p className="m-0 text-[11.5px] leading-relaxed text-hf-stone-600">
                Esse extrato é um retrato congelado desse período. Se alguma despesa ou venda for editada
                depois, esses valores não mudam — pra alterar, seria preciso um novo acerto.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
