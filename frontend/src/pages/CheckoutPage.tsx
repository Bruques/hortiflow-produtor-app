import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkoutRequest, statusAssinaturaRequest, verificarPedidoPixRequest } from '@/services/assinatura';
import { cn } from '@/lib/utils';
import type { AssinaturaStatus } from '@/types/assinatura';

interface PixGerado {
  orderId: string;
  qrCode: string;
  qrCodeBase64: string;
  dataExpiracao: string;
}

// Spec 25 — checkout pós-trial, equivalente ao mobile/src/screens/CheckoutScreen.tsx.
//
// Cartão: "abrir o checkout hospedado" é simplesmente redirecionar a aba pro `initPoint`.
// Pix: NÃO redireciona — usa a API de Orders do Mercado Pago (ver backend/src/services/
// mercadopago.service.ts), mostrando o QR Code direto nesta página. Botão "Já paguei —
// verificar" é uma rede de segurança enquanto o formato do webhook de pedidos não foi
// validado contra um evento real.
export default function CheckoutPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [metodo, setMetodo] = useState<'CARTAO' | 'PIX'>('CARTAO');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [pixStatus, setPixStatus] = useState('action_required');
  const [copiado, setCopiado] = useState(false);
  const [verificando, setVerificando] = useState(false);

  // Bug relatado pelo dev (2026-09-15): o pagamento confirma via webhook, mas se o produtor
  // só der F5 nesta tela (em vez de navegar de volta manualmente), ela recarregava do zero e
  // mostrava o formulário de checkout de novo, como se ainda estivesse pendente — mesmo já
  // pago. Corrigido checando `vencida` aqui: se o acesso já está liberado, redireciona pra
  // Início em vez de renderizar o checkout.
  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        if (!dados.vencida) {
          navigate('/', { replace: true });
          return;
        }
        setStatus(dados);
        if (dados.ciclo) setCiclo(dados.ciclo);
      })
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function irParaPagamento() {
    if (!status?.plano) return;
    setProcessando(true);
    setErro(null);
    try {
      const resultado = await checkoutRequest({ planoId: status.plano.id, ciclo, metodo });

      if (resultado.tipo === 'PIX') {
        setPix({
          orderId: resultado.mpOrderId,
          qrCode: resultado.qrCode,
          qrCodeBase64: resultado.qrCodeBase64,
          dataExpiracao: resultado.dataExpiracao,
        });
        setPixStatus('action_required');
        return;
      }

      window.location.href = resultado.initPoint;
    } catch {
      setErro('Não foi possível iniciar o pagamento');
      setProcessando(false);
    }
  }

  async function copiarCodigoPix() {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.qrCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function jaPagueiVerificar() {
    if (!pix) return;
    setVerificando(true);
    setErro(null);
    try {
      const resultado = await verificarPedidoPixRequest(pix.orderId);
      setPixStatus(resultado.pedidoStatus);
      if (!resultado.vencida) {
        window.location.href = '/';
      }
    } catch {
      setErro('Não foi possível verificar o pagamento');
    } finally {
      setVerificando(false);
    }
  }

  if (pix) {
    const horaExpiracao = pix.dataExpiracao
      ? new Date(pix.dataExpiracao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '—';
    return (
      <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">Escaneie pra pagar</h1>
          <p className="text-[13px] leading-relaxed text-hf-stone-600">
            Abra o app do seu banco, escaneie o QR Code ou cole o código copia-e-cola.
          </p>

          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR Code Pix"
            className="h-60 w-60 rounded-2xl border border-hf-line bg-white"
          />

          <button
            type="button"
            onClick={copiarCodigoPix}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-sm font-bold text-hf-green-700"
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? 'Código copiado' : 'Copiar código Pix'}
          </button>

          <div className="w-full rounded-2xl border border-hf-line p-3">
            <p className="m-0 text-[13px] text-hf-stone-600">Vence em: {horaExpiracao}</p>
            <p className="m-0 text-[13px] text-hf-stone-600">
              Status: {pixStatus === 'action_required' ? 'aguardando pagamento' : pixStatus}
            </p>
          </div>

          <button
            type="button"
            onClick={jaPagueiVerificar}
            disabled={verificando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hf-green-100 py-3 text-sm font-bold text-hf-green-800 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', verificando && 'animate-spin')} />
            {verificando ? 'Verificando...' : 'Já paguei — verificar'}
          </button>

          {erro && <p className="text-sm font-medium text-hf-red">{erro}</p>}

          <p className="text-[12.5px] leading-relaxed text-hf-stone-600">
            A confirmação é automática assim que o Mercado Pago aprovar.
          </p>

          <a href="/" className="text-sm font-bold text-hf-green-700">
            Voltar pro início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-5">
        <div className="text-center">
          <h1 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">Assinar {status?.plano?.nome ?? ''}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-hf-stone-600">
            Escolha o ciclo e a forma de pagamento pra continuar usando o HortiFlow.
          </p>
        </div>

        {carregando && <p className="text-center text-sm text-hf-stone-400">Carregando...</p>}

        {!carregando && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-hf-stone-900">Ciclo</span>
              <div className="flex gap-2">
                <Opcao rotulo="Mensal" ativo={ciclo === 'MENSAL'} onClick={() => setCiclo('MENSAL')} />
                <Opcao rotulo="Anual" ativo={ciclo === 'ANUAL'} onClick={() => setCiclo('ANUAL')} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-hf-stone-900">Forma de pagamento</span>
              <div className="flex gap-2">
                <Opcao rotulo="Cartão de crédito" ativo={metodo === 'CARTAO'} onClick={() => setMetodo('CARTAO')} />
                <Opcao rotulo="Pix" ativo={metodo === 'PIX'} onClick={() => setMetodo('PIX')} />
              </div>
            </div>

            {ciclo === 'MENSAL' && metodo === 'PIX' && (
              <p className="rounded-xl bg-hf-amber-bg p-3 text-[12px] leading-relaxed text-hf-amber">
                No Pix mensal não há débito automático — você recebe um novo código todo mês e precisa pagar manualmente.
              </p>
            )}

            {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

            <Button
              size="lg"
              className="w-full bg-hf-green-800 hover:bg-hf-green-900"
              onClick={irParaPagamento}
              disabled={processando}
            >
              {processando ? 'Processando...' : metodo === 'PIX' ? 'Gerar QR Code' : 'Ir para pagamento'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Opcao({ rotulo, ativo, onClick }: { rotulo: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border-[1.5px] border-hf-line bg-white py-3 text-[13px] font-bold text-hf-stone-600',
        ativo && 'border-hf-green-700 bg-hf-green-100 text-hf-green-800'
      )}
    >
      {rotulo}
    </button>
  );
}
