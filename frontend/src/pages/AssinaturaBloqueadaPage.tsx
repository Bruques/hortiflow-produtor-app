import { PhoneCall, Mail } from 'lucide-react';

// Spec 18 — mostrada quando qualquer chamada à API retorna 402 (assinatura vencida do
// titular da sociedade). Contato fixo: manter em sincronia com WHATSAPP_CONTATO/EMAIL_CONTATO
// no backend (backend/.env) — duplicado aqui só porque o frontend não tem acesso a envs do
// backend, não há endpoint dedicado só pra isso.
const WHATSAPP_CONTATO = '(35) 99730-2015';
const EMAIL_CONTATO = 'contato.hortiflow@gmail.com';

export default function AssinaturaBloqueadaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-[22px] py-[18px]">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h2 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">
          Seu acesso ao HortiFlow expirou
        </h2>
        <p className="m-0 text-sm text-hf-stone-400">
          Fale com a gente para continuar usando o app e liberar seu plano.
        </p>

        <div className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-hf-line p-4">
          <a
            href={`https://wa.me/55${WHATSAPP_CONTATO.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white"
          >
            <PhoneCall className="h-4 w-4" strokeWidth={2.3} />
            WhatsApp {WHATSAPP_CONTATO}
          </a>
          <a
            href={`mailto:${EMAIL_CONTATO}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-900"
          >
            <Mail className="h-4 w-4" strokeWidth={2.3} />
            {EMAIL_CONTATO}
          </a>
        </div>
      </div>
    </div>
  );
}
