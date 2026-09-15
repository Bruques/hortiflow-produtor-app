import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Spec 25 — destino do `back_urls`/`retornoUrl` do checkout hospedado do Mercado Pago no
// web. A confirmação de pagamento chega por webhook (assíncrona) — esta tela não sabe se
// já foi processada, só devolve o produtor pro app.
export default function CheckoutRetornoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hf-cream-50 px-6 text-center">
      <h1 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">Pagamento em processamento</h1>
      <p className="max-w-[30ch] text-sm leading-relaxed text-hf-stone-600">
        Assim que o Mercado Pago confirmar, seu acesso é liberado automaticamente.
      </p>
      <Button size="lg" className="bg-hf-green-800 hover:bg-hf-green-900" onClick={() => navigate('/', { replace: true })}>
        Voltar pro início
      </Button>
    </div>
  );
}
