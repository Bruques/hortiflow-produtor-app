import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { useSafraAtiva } from '@/lib/SafraContext';
import { listarAcertosRequest } from '@/services/acertos';
import { buscarSimulacaoRequest, buscarSimulacaoPersonalizadaRequest } from '@/services/simulacao';
import { adicionarDias } from '@/lib/periodo';
import { cn, formatarData, formatarMoeda } from '@/lib/utils';
import { ROTULO_STATUS_SAFRA } from '@/lib/rotulos';
import type { AcertoResumo } from '@/types/acerto';

export default function AcertosPage() {
  const { safraId, safra } = useSafraAtiva();
  const navigate = useNavigate();

  const [acertos, setAcertos] = useState<AcertoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lucroNaoDividido, setLucroNaoDividido] = useState<number | null>(null);

  useEffect(() => {
    setCarregando(true);
    listarAcertosRequest(safraId)
      .then(setAcertos)
      .catch(() => setErro('Não foi possível carregar os acertos'))
      .finally(() => setCarregando(false));
  }, [safraId]);

  useEffect(() => {
    // Lucro ainda não coberto por nenhum Acerto: desde o dia seguinte ao data_fim do último
    // (o próprio data_fim já foi congelado por ele) até hoje. Sem nenhum Acerto ainda, é a
    // safra inteira até agora.
    async function calcular() {
      if (acertos.length > 0) {
        const inicio = adicionarDias(acertos[0].data_fim, 1);
        const hoje = new Date().toISOString().slice(0, 10);
        if (inicio > hoje) {
          setLucroNaoDividido(0);
          return;
        }
        const sim = await buscarSimulacaoPersonalizadaRequest(safraId, inicio, hoje);
        setLucroNaoDividido(sim.lucroLiquido);
      } else {
        const sim = await buscarSimulacaoRequest(safraId, 'safra');
        setLucroNaoDividido(sim.lucroLiquido);
      }
    }
    calcular().catch(() => {});
  }, [acertos, safraId]);

  return (
    <div>
      <Topbar />

      <div className="mx-auto flex max-w-sm flex-col gap-6 px-[22px] pb-6 pt-3.5">
        <div>
          <h2 className="font-rounded text-[20px] font-extrabold text-hf-stone-900">Acertos</h2>
          <p className="mt-0.5 text-[12.5px] text-hf-stone-600">
            {safra.nome} · {ROTULO_STATUS_SAFRA[safra.status].toLowerCase()}
          </p>
        </div>

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            // A tela "Registrar acerto" ainda não foi construída (checklist), então esse botão
            // aponta pra uma rota que ainda não existe — assim que ela for criada, numa sessão
            // dedicada, é só registrar a rota que este link já funciona.
            onClick={() => navigate(`/safras/${safraId}/acertos/novo`)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-hf-green-800 py-4 text-[14.5px] font-bold text-white"
          >
            <FileText className="h-[17px] w-[17px]" strokeWidth={2} />
            Registrar novo acerto
          </button>
          {lucroNaoDividido !== null && (
            <p className="text-center text-xs text-hf-stone-600">
              {acertos.length > 0 ? (
                <>Desde o último acerto ({formatarData(acertos[0].data_fim)}): </>
              ) : (
                <>Nesta safra até agora: </>
              )}
              <b className="text-hf-stone-900">{formatarMoeda(lucroNaoDividido)}</b> de lucro ainda não dividido
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-base font-extrabold text-hf-stone-900">Histórico</h3>

          {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}
          {!carregando && acertos.length === 0 && (
            <p className="text-center text-sm text-hf-stone-600">Nenhum acerto registrado ainda.</p>
          )}

          <div>
            {acertos.map((a) => (
              <Link
                key={a.id}
                to={`/acertos/${a.id}`}
                className="flex items-center gap-3 border-b border-hf-cream-100 py-3.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide',
                      a.tipo === 'FINAL' ? 'bg-hf-green-800 text-white' : 'bg-hf-blue-bg text-hf-blue'
                    )}
                  >
                    {a.tipo === 'FINAL' ? 'Final' : 'Parcial'}
                  </span>
                  <p className="m-0 mb-0.5 mt-1.5 text-[13.5px] font-bold text-hf-stone-900">
                    {formatarData(a.data_inicio)} – {formatarData(a.data_fim)}
                  </p>
                  <p className="m-0 text-[11px] text-hf-stone-400">Registrado em {formatarData(a.criado_em)}</p>
                </div>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-hf-line" strokeWidth={2.2} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
