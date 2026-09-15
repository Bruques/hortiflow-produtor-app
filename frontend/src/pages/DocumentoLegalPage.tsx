import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { DocumentoLegal } from '@/content/documentosLegais';

// Spec 26 — leitura completa de um documento legal (Termos de Uso ou Política de
// Privacidade). Usada tanto na tela de aceite/cadastro (acessível sem estar logado) quanto
// em Configurações → Conta, pra consulta a qualquer momento.
export default function DocumentoLegalPage({ documento }: { documento: DocumentoLegal }) {
  const navigate = useNavigate();
  const location = useLocation();

  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-hf-cream-50">
      <div className="sticky top-0 z-10 bg-hf-cream-50 px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={voltar}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">
            {documento.titulo}
          </h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-[22px] py-[18px]">
        <p className="m-0 text-xs text-hf-stone-400">
          Versão {documento.versao} — última atualização em {documento.atualizadoEm}
        </p>
        <p className="m-0 text-sm leading-relaxed text-hf-stone-900">{documento.intro}</p>

        {documento.secoes.map((secao) => (
          <div key={secao.titulo} className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-extrabold text-hf-stone-900">{secao.titulo}</h3>
            {secao.paragrafos.map((paragrafo, i) => (
              <p key={i} className="m-0 text-[13.5px] leading-relaxed text-hf-stone-600">
                {paragrafo}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
