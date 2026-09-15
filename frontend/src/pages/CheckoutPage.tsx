import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { checkoutRequest, statusAssinaturaRequest } from '@/services/assinatura';
import { cn } from '@/lib/utils';
import type { AssinaturaStatus } from '@/types/assinatura';

// Spec 25 — checkout pós-trial, equivalente ao mobile/src/screens/CheckoutScreen.tsx. No
// web, "abrir o checkout hospedado" é simplesmente redirecionar a aba pro `initPoint` — sem
// WebView, sem app externo.
//
// Cartão e Pix vão os dois por esse mesmo caminho hoje: tentamos um Pix sem redirecionar
// (QR Code direto via API de Pagamentos), mas a conta de teste bateu num erro de
// autorização do Mercado Pago não resolvido ainda — ver aviso em
// backend/src/services/mercadopago.service.ts.
export default function CheckoutPage() {
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [metodo, setMetodo] = useState<'CARTAO' | 'PIX'>('CARTAO');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        setStatus(dados);
        if (dados.ciclo) setCiclo(dados.ciclo);
      })
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
  }, []);

  async function irParaPagamento() {
    if (!status?.plano) return;
    setProcessando(true);
    setErro(null);
    try {
      const resultado = await checkoutRequest({ planoId: status.plano.id, ciclo, metodo });
      window.location.href = resultado.initPoint;
    } catch {
      setErro('Não foi possível iniciar o pagamento');
      setProcessando(false);
    }
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

            <Button size="lg" className="w-full bg-hf-green-800 hover:bg-hf-green-900" onClick={irParaPagamento} disabled={processando}>
              {processando ? 'Abrindo pagamento...' : 'Ir para pagamento'}
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
