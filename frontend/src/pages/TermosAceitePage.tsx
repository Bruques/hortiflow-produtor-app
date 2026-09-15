import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logoutRequest } from '@/services/auth';
import { aceitarTermosRequest } from '@/services/termos';
import DocumentoLegalModal from '@/components/DocumentoLegalModal';
import { TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE } from '@/content/documentosLegais';

// Spec 26 — mostrada tanto no primeiro login de quem já tinha conta antes dessa
// funcionalidade existir, quanto sempre que a versão vigente de Termos/Privacidade mudar
// (chegada aqui via 401 TERMOS_PENDENTES no apiClient, ver interceptor). Segue o mesmo
// padrão de tela bloqueante de AssinaturaBloqueadaPage.tsx: quem não quiser aceitar só pode sair.
export default function TermosAceitePage() {
  const navigate = useNavigate();
  const [aceitou, setAceitou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [documentoAberto, setDocumentoAberto] = useState<'uso' | 'privacidade' | null>(null);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await aceitarTermosRequest();
      navigate('/');
    } catch {
      setErro('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function sair() {
    logoutRequest(false);
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-[22px] py-[18px]">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h2 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">
          Termos de Uso e Política de Privacidade
        </h2>
        <p className="m-0 text-sm text-hf-stone-400">
          Atualizamos nossos documentos. Para continuar usando o HortiFlow Produtor, leia e aceite abaixo.
        </p>

        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setDocumentoAberto('uso')}
            className="flex items-center justify-center rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-900"
          >
            Ler Termos de Uso
          </button>
          <button
            type="button"
            onClick={() => setDocumentoAberto('privacidade')}
            className="flex items-center justify-center rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-900"
          >
            Ler Política de Privacidade
          </button>
        </div>

        <label className="mt-1 flex items-start gap-2.5 text-left text-sm text-hf-stone-600">
          <input
            type="checkbox"
            checked={aceitou}
            onChange={(e) => setAceitou(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-hf-green-800"
          />
          Li e concordo com os Termos de Uso e a Política de Privacidade do HortiFlow Produtor.
        </label>

        {erro && <p className="m-0 text-sm font-medium text-hf-red">{erro}</p>}

        <button
          type="button"
          onClick={confirmar}
          disabled={!aceitou || enviando}
          className="mt-1 w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Aceitar e continuar'}
        </button>

        <button
          type="button"
          onClick={sair}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-sm font-bold text-hf-red"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair da conta
        </button>
      </div>

      {documentoAberto && (
        <DocumentoLegalModal
          documento={documentoAberto === 'uso' ? TERMOS_DE_USO : POLITICA_DE_PRIVACIDADE}
          onClose={() => setDocumentoAberto(null)}
        />
      )}
    </div>
  );
}
