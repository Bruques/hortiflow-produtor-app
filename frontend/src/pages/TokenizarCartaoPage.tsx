import { useState } from 'react';
import { CartaoTokenForm } from '@/components/CartaoTokenForm';

// Spec 25 — página pública (sem login, fora do PrivateRoute), aberta só dentro de uma
// WebView pelo app mobile (mobile/src/screens/CheckoutScreen.tsx) pra tokenizar o cartão do
// cartão mensal recorrente. Não é navegada pelo usuário web (o CheckoutPage já embute
// CartaoTokenForm direto na própria página) — existe só pra dar ao mobile uma superfície web
// onde rodar a SDK JS do Mercado Pago, que não tem equivalente nativo React Native oficial.
// Ao gerar o token, manda de volta pro app via `window.ReactNativeWebView.postMessage` —
// fora de uma WebView (ex: aberta direto no navegador por engano) só mostra um aviso.
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (mensagem: string) => void };
  }
}

export default function TokenizarCartaoPage() {
  const [erro, setErro] = useState<string | null>(null);
  const dentroDeWebView = typeof window !== 'undefined' && !!window.ReactNativeWebView;

  function onToken(cardTokenId: string) {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ tipo: 'CARD_TOKEN', cardTokenId }));
  }

  function onErro(mensagem: string) {
    setErro(mensagem);
    window.ReactNativeWebView?.postMessage(JSON.stringify({ tipo: 'CARD_TOKEN_ERRO', mensagem }));
  }

  if (!dentroDeWebView) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-hf-stone-400">
        Essa página só funciona dentro do app HortiFlow.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hf-cream-50 px-5 py-6">
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        <div className="text-center">
          <h1 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Dados do cartão</h1>
          <p className="mt-1 text-[12.5px] text-hf-stone-600">Usado só pra confirmar a cobrança mensal automática.</p>
        </div>
        <CartaoTokenForm onToken={onToken} onErro={onErro} />
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}
      </div>
    </div>
  );
}
