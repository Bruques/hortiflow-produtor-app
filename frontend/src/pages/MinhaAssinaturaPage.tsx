import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { statusAssinaturaRequest, cancelarAssinaturaRequest } from '@/services/assinatura';
import type { AssinaturaStatus } from '@/types/assinatura';

const ROTULO_STATUS: Record<AssinaturaStatus['status'], string> = {
  TRIAL: 'Período de teste',
  ATIVA: 'Ativa',
  CANCELADA: 'Cancelada',
};

export default function MinhaAssinaturaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dados, setDados] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate('/');
  }

  function carregar() {
    setCarregando(true);
    statusAssinaturaRequest()
      .then(setDados)
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cancelar() {
    setCancelando(true);
    setErro(null);
    try {
      await cancelarAssinaturaRequest();
      setConfirmarCancelamento(false);
      carregar();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErro(data?.error ?? 'Não foi possível cancelar a assinatura');
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={voltar}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Minha assinatura</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-[22px] py-[18px]">
        {carregando && <p className="text-center text-sm text-hf-stone-400">Carregando...</p>}

        {!carregando && dados && (
          <div className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-hf-green-700">Plano</span>
              <span className="text-sm font-bold text-hf-stone-900">{dados.plano?.nome ?? 'Ainda não atribuído'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-hf-green-700">Situação</span>
              <span className={`text-sm font-bold ${dados.vencida ? 'text-hf-red' : 'text-hf-stone-900'}`}>
                {dados.vencida ? 'Vencida' : ROTULO_STATUS[dados.status]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-hf-green-700">
                {dados.vencida ? 'Venceu em' : 'Acesso liberado até'}
              </span>
              <span className="text-sm font-bold text-hf-stone-900">
                {new Date(dados.dataFimAcesso).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {dados.plano?.limiteSafrasAtivas !== null && dados.plano !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-hf-green-700">Safras ativas</span>
                <span className="text-sm font-bold text-hf-stone-900">
                  {dados.safrasAtivas} de {dados.plano?.limiteSafrasAtivas}
                </span>
              </div>
            )}
          </div>
        )}

        {erro && <p className="m-0 text-center text-sm font-medium text-hf-red">{erro}</p>}

        {!carregando && dados?.podeCancelar && !confirmarCancelamento && (
          <button
            type="button"
            onClick={() => setConfirmarCancelamento(true)}
            className="w-full rounded-xl border border-hf-red py-2.5 text-[13px] font-bold text-hf-red"
          >
            Cancelar assinatura
          </button>
        )}

        {confirmarCancelamento && (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-hf-red p-3.5">
            <p className="m-0 text-sm text-hf-stone-900">
              Sua próxima cobrança não vai acontecer. O acesso continua liberado até{' '}
              {dados && new Date(dados.dataFimAcesso).toLocaleDateString('pt-BR')}. Tem certeza?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmarCancelamento(false)}
                className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-900"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={cancelar}
                disabled={cancelando}
                className="flex-1 rounded-xl bg-hf-red py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {cancelando ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
