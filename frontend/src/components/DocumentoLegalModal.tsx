import { X } from 'lucide-react';
import type { DocumentoLegal } from '@/content/documentosLegais';

// Spec 26 — mostrado por cima da própria tela (cadastro ou aceite), nunca como navegação de
// página nem em nova aba: abrir em nova aba fazia o botão "voltar" do navegador cair na rota
// /login dentro daquela mesma aba nova (primeira entrada do histórico dela), sem nenhuma
// relação com a aba original — o usuário perdia nome/telefone/senha já digitados (reportado
// pelo dev, 2026-09-15). Como modal, a tela de baixo nunca desmonta.
export default function DocumentoLegalModal({
  documento,
  onClose,
}: {
  documento: DocumentoLegal;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hf-line px-5 py-4">
          <h2 className="m-0 font-rounded text-[16px] font-extrabold text-hf-stone-900">{documento.titulo}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-hf-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
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
    </div>
  );
}
