import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkoutRequest, statusAssinaturaRequest } from '@/services/assinatura';
import { cn, formatarCpf } from '@/lib/utils';
import type { AssinaturaStatus } from '@/types/assinatura';

interface PixGerado {
  qrCode: string;
  qrCodeBase64: string;
}

// Spec 25 — checkout pós-trial, equivalente ao mobile/src/screens/CheckoutScreen.tsx.
//
// Cartão: "abrir o checkout hospedado" é simplesmente redirecionar a aba pro `initPoint`.
// Pix: NÃO redireciona — testado em 2026-09-15 e o Checkout Pro exige login numa conta
// Mercado Pago pra pagar via Pix, o que não serve pro nosso caso. Em vez disso, mostra o
// QR Code direto nesta página (gerado via API de Pagamentos, que exige CPF do pagador).
export default function CheckoutPage() {
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [metodo, setMetodo] = useState<'CARTAO' | 'PIX'>('CARTAO');
  const [cpf, setCpf] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        setStatus(dados);
        if (dados.ciclo) setCiclo(dados.ciclo);
      })
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
  }, []);

  const cpfValido = cpf.replace(/\D/g, '').length === 11;

  async function irParaPagamento() {
    if (!status?.plano) return;
    if (metodo === 'PIX' && !cpfValido) return;
    setProcessando(true);
    setErro(null);
    try {
      const resultado = await checkoutRequest({
        planoId: status.plano.id,
        ciclo,
        metodo,
        cpf: metodo === 'PIX' ? cpf.replace(/\D/g, '') : undefined,
      });

      if (resultado.tipo === 'PIX') {
        setPix({ qrCode: resultado.qrCode, qrCodeBase64: resultado.qrCodeBase64 });
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

  if (pix) {
    return (
      <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-5 text-center">
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

          <p className="text-[12.5px] leading-relaxed text-hf-stone-600">
            Assim que o pagamento for confirmado, seu acesso é liberado automaticamente — não precisa voltar aqui.
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

            {metodo === 'PIX' && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold text-hf-stone-900">CPF (exigido pelo Mercado Pago pra gerar o Pix)</span>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={formatarCpf(cpf)}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
                  maxLength={14}
                />
              </div>
            )}

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
              disabled={processando || (metodo === 'PIX' && !cpfValido)}
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
