import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { escolherPlanoRequest, listarPlanosRequest, type PlanoCatalogo } from '@/services/assinatura';
import { formatarMoeda } from '@/lib/utils';
import { cn } from '@/lib/utils';

// Spec 25 — tela de plano (Fluxo A), equivalente ao
// mobile/src/screens/OnboardingPlanoScreen.tsx. Plano recomendado vem expandido por
// padrão; ciclo anual nunca mostra o total como número principal.
export default function OnboardingPlanoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planoRecomendadoId = searchParams.get('recomendado') ?? '';

  const [planos, setPlanos] = useState<PlanoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [expandidoId, setExpandidoId] = useState<string | null>(planoRecomendadoId);
  const [selecionadoId, setSelecionadoId] = useState(planoRecomendadoId);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    listarPlanosRequest()
      .then(setPlanos)
      .catch(() => setErro('Não foi possível carregar os planos'))
      .finally(() => setCarregando(false));
  }, []);

  function alternarExpandido(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id));
    setSelecionadoId(id);
  }

  async function confirmar() {
    setConfirmando(true);
    setErro(null);
    try {
      await escolherPlanoRequest(selecionadoId, ciclo);
      navigate('/', { replace: true });
    } catch {
      setErro('Não foi possível confirmar o plano');
      setConfirmando(false);
    }
  }

  const planoSelecionado = planos.find((p) => p.id === selecionadoId);

  return (
    <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-5">
        <div className="text-center">
          <h1 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">Plano recomendado pra você</h1>
          <p className="mt-0.5 text-[13px] text-hf-stone-600">Você pode trocar de plano quando quiser.</p>
        </div>

        <div className="flex gap-1 rounded-2xl bg-hf-cream-100 p-1">
          <button
            type="button"
            onClick={() => setCiclo('MENSAL')}
            className={cn('flex-1 rounded-xl py-2.5 text-[13px] font-bold text-hf-stone-600', ciclo === 'MENSAL' && 'bg-white text-hf-green-800')}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCiclo('ANUAL')}
            className={cn('flex-1 rounded-xl py-2.5 text-[13px] font-bold text-hf-stone-600', ciclo === 'ANUAL' && 'bg-white text-hf-green-800')}
          >
            Anual — 20% de desconto
          </button>
        </div>

        {carregando && <p className="text-center text-sm text-hf-stone-400">Carregando...</p>}

        <div className="flex flex-col gap-2.5">
          {planos.map((plano) => {
            const expandido = expandidoId === plano.id;
            const recomendado = plano.id === planoRecomendadoId;
            const selecionado = selecionadoId === plano.id;
            return (
              <button
                key={plano.id}
                type="button"
                onClick={() => alternarExpandido(plano.id)}
                // O destaque verde segue a SELEÇÃO, não a recomendação — antes o cartão
                // recomendado ficava sempre verde mesmo quando o usuário selecionava outro
                // plano, dando a impressão de que o recomendado continuava escolhido
                // (bug relatado pelo dev, 2026-09-15). "Recomendado" agora é só o selo.
                className={cn(
                  'relative flex flex-col rounded-2xl border-[1.5px] border-hf-line bg-white p-4 text-left',
                  selecionado && 'border-hf-green-700 bg-hf-green-100'
                )}
              >
                {recomendado && (
                  <span className="absolute -top-2.5 left-3.5 rounded-full bg-hf-amber px-2.5 py-0.5 text-[10px] font-extrabold text-white">
                    Recomendado
                  </span>
                )}

                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="m-0 text-[15px] font-extrabold text-hf-stone-900">{plano.nome}</p>
                    {ciclo === 'MENSAL' ? (
                      <p className="m-0 mt-0.5 text-[17px] font-extrabold text-hf-green-800">{formatarMoeda(plano.valorMensal)}/mês</p>
                    ) : (
                      <>
                        <p className="m-0 mt-0.5 text-[17px] font-extrabold text-hf-green-800">
                          {formatarMoeda(plano.valorAnualExibidoPorMes)}/mês
                        </p>
                        <p className="m-0 text-[11.5px] text-hf-stone-600">{formatarMoeda(plano.valorAnualTotal)}/ano</p>
                      </>
                    )}
                  </div>
                  {selecionadoId === plano.id && (
                    <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-hf-green-700">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>

                {expandido && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-hf-line pt-3">
                    <LinhaRecurso rotulo="Safras ativas" valor={plano.limiteSafrasAtivas === null ? 'Ilimitado' : `Até ${plano.limiteSafrasAtivas}`} />
                    <LinhaRecurso rotulo="Importação por IA" valor={`Até ${plano.limiteImportacaoIAMes}/mês`} />
                    <LinhaRecurso rotulo="Despesas pessoais" valor={plano.despesasPessoais ? 'Incluso' : 'Não incluso'} />
                    <LinhaRecurso rotulo="Suporte prioritário" valor={plano.suportePrioritario ? 'Incluso' : 'Não incluso'} />
                    <LinhaRecurso
                      rotulo="Implantação assistida"
                      valor={ciclo === 'ANUAL' || plano.implantacaoAssistidaMensal ? 'Incluso' : 'Não incluso'}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <Button size="lg" className="w-full bg-hf-green-800 hover:bg-hf-green-900" onClick={confirmar} disabled={confirmando}>
          {confirmando ? 'Confirmando...' : `Continuar com ${planoSelecionado?.nome ?? '...'}`}
        </Button>
      </div>
    </div>
  );
}

function LinhaRecurso({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[12.5px] text-hf-stone-600">{rotulo}</span>
      <span className="text-[12.5px] font-bold text-hf-stone-900">{valor}</span>
    </div>
  );
}
