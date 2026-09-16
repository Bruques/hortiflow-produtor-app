import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Spec 25 — tokenização de cartão pro cartão mensal recorrente (débito automático).
//
// Usa o MercadoPago.js v2 direto via script (não a SDK @mercadopago/sdk-react), pelo mesmo
// motivo que essa página também precisa funcionar sozinha dentro de uma WebView (mobile
// carrega ela sem o resto do bundle React Native — ver TokenizarCartaoPage.tsx e
// mobile/src/screens/CheckoutScreen.tsx). Número do cartão, validade e CVV são "Secure
// Fields" — a Mercado Pago monta iframes deles, o dado nunca passa pelo nosso JS nem pelo
// nosso servidor; só o token final (`createCardToken`) chega no nosso código.
declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: { locale?: string }) => MpInstance;
  }
}

interface MpSecureField {
  mount: (elementId: string) => void;
  unmount: () => void;
}

interface MpInstance {
  fields: {
    create: (tipo: string, opts?: Record<string, unknown>) => MpSecureField;
    createCardToken: (dados: Record<string, unknown>) => Promise<{ id: string }>;
  };
}

const SDK_SRC = 'https://sdk.mercadopago.com/js/v2';

function carregarSdkMercadoPago(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  const existente = document.querySelector(`script[src="${SDK_SRC}"]`);
  if (existente) {
    return new Promise((resolve) => existente.addEventListener('load', () => resolve()));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o Mercado Pago'));
    document.head.appendChild(script);
  });
}

interface Props {
  onToken: (cardTokenId: string) => void;
  onErro: (mensagem: string) => void;
  // Desabilita o botão de confirmar enquanto o checkout (chamada seguinte, fora deste
  // componente) está em andamento — evita duplo toque criando duas assinaturas.
  processando?: boolean;
}

export function CartaoTokenForm({ onToken, onErro, processando }: Props) {
  const [pronto, setPronto] = useState(false);
  const [tokenizando, setTokenizando] = useState(false);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const mpRef = useRef<MpInstance | null>(null);
  const camposRef = useRef<{ numero: MpSecureField; validade: MpSecureField; cvv: MpSecureField } | null>(null);

  useEffect(() => {
    let cancelado = false;
    carregarSdkMercadoPago()
      .then(() => {
        if (cancelado || !window.MercadoPago) return;
        const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined;
        if (!publicKey) {
          onErro('Configuração de pagamento ausente (public key)');
          return;
        }
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        mpRef.current = mp;

        const estiloComum = {
          style: { fontSize: '15px', fontFamily: 'inherit', color: '#1c1917' },
          placeholder: '',
        };
        const numero = mp.fields.create('cardNumber', { ...estiloComum, placeholder: '0000 0000 0000 0000' });
        const validade = mp.fields.create('expirationDate', { ...estiloComum, placeholder: 'MM/AA' });
        const cvv = mp.fields.create('securityCode', { ...estiloComum, placeholder: 'CVV' });
        numero.mount('campo-numero-cartao');
        validade.mount('campo-validade-cartao');
        cvv.mount('campo-cvv-cartao');
        camposRef.current = { numero, validade, cvv };
        setPronto(true);
      })
      .catch(() => onErro('Não foi possível carregar o formulário de cartão'));

    return () => {
      cancelado = true;
      camposRef.current?.numero.unmount();
      camposRef.current?.validade.unmount();
      camposRef.current?.cvv.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tokenizar() {
    if (!mpRef.current) return;
    if (!nome.trim() || cpf.replace(/\D/g, '').length !== 11) {
      onErro('Preencha o nome impresso no cartão e um CPF válido');
      return;
    }
    setTokenizando(true);
    try {
      const { id } = await mpRef.current.fields.createCardToken({
        cardholderName: nome.trim(),
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
      });
      onToken(id);
    } catch {
      onErro('Não foi possível validar o cartão — confira os dados e tente de novo');
    } finally {
      setTokenizando(false);
    }
  }

  const desabilitado = !pronto || tokenizando || !!processando;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold text-hf-stone-900">Número do cartão</span>
        <div id="campo-numero-cartao" className={cn('h-11 rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5')} />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[12px] font-bold text-hf-stone-900">Validade</span>
          <div id="campo-validade-cartao" className="h-11 rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[12px] font-bold text-hf-stone-900">CVV</span>
          <div id="campo-cvv-cartao" className="h-11 rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold text-hf-stone-900">Nome impresso no cartão</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como está no cartão"
          className="h-11 rounded-xl border-[1.5px] border-hf-line bg-white px-3 text-[15px] outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold text-hf-stone-900">CPF do titular</span>
        <input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="h-11 rounded-xl border-[1.5px] border-hf-line bg-white px-3 text-[15px] outline-none"
        />
      </div>

      <button
        type="button"
        onClick={tokenizar}
        disabled={desabilitado}
        className="mt-1 flex h-12 items-center justify-center rounded-2xl bg-hf-green-800 text-sm font-bold text-white disabled:opacity-50"
      >
        {tokenizando || processando ? 'Confirmando...' : !pronto ? 'Carregando...' : 'Confirmar assinatura mensal'}
      </button>
    </div>
  );
}
