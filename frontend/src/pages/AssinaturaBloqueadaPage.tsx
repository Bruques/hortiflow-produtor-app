import { useNavigate } from 'react-router-dom';
import { PhoneCall, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logoutRequest } from '@/services/auth';

// Spec 18 — mostrada quando qualquer chamada à API retorna 402 (assinatura vencida do
// titular da sociedade). Atualizada pela spec 25: "Assinar agora" (checkout no próprio
// site) passa a ser a ação principal — o contato manual continua como alternativa
// secundária. Contato fixo: manter em sincronia com WHATSAPP_CONTATO/EMAIL_CONTATO no
// backend (backend/.env) — duplicado aqui só porque o frontend não tem acesso a envs do
// backend, não há endpoint dedicado só pra isso.
const WHATSAPP_CONTATO = '(35) 99730-2015';
const EMAIL_CONTATO = 'contato.hortiflow@gmail.com';

export default function AssinaturaBloqueadaPage() {
  const navigate = useNavigate();

  // Sem esse botão, quem cai nessa tela (acesso vencido) ficava preso sem jeito de trocar
  // de conta — o resto do app só tem "Sair" dentro do Menu, que essa tela substitui por
  // completo (dev relatou, 2026-09-15).
  function sair() {
    logoutRequest(false);
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-[22px] py-[18px]">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h2 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">
          Seu teste grátis acabou
        </h2>
        <p className="m-0 text-sm text-hf-stone-400">
          Assine pra continuar usando o app e acompanhar sua lavoura.
        </p>

        <Button size="lg" className="w-full bg-hf-green-800 hover:bg-hf-green-900" onClick={() => navigate('/assinatura/checkout')}>
          Assinar agora
        </Button>

        <div className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-hf-line p-4">
          <p className="m-0 text-center text-xs font-bold text-hf-stone-400">Prefere ser atendido diretamente?</p>
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

        <button
          type="button"
          onClick={sair}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-sm font-bold text-hf-red"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );
}
