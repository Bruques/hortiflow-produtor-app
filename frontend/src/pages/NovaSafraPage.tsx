import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sprout, AlertTriangle, Info } from 'lucide-react';
import { abrirSafraRequest, listarSafrasRequest } from '@/services/safras';
import type { Safra } from '@/types/safra';

function nomeSugerido(): string {
  const ano = new Date().getFullYear();
  return `Safra ${ano}/${ano + 1}`;
}

export default function NovaSafraPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [nome, setNome] = useState(nomeSugerido());
  const [safraEmAndamento, setSafraEmAndamento] = useState<Safra | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!sociedadeId) return;
    listarSafrasRequest(sociedadeId)
      .then((res) => {
        const emAndamento = res.safras.find((s) => s.status === 'EM_ANDAMENTO');
        setSafraEmAndamento(emAndamento ?? null);
      })
      .catch(() => {});
  }, [sociedadeId]);

  async function criar() {
    if (!sociedadeId || !nome.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      const { safra } = await abrirSafraRequest(sociedadeId, nome.trim());
      navigate(`/safras/${safra.id}`);
    } catch {
      setErro('Não foi possível criar a safra');
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(`/sociedades/${sociedadeId}/safras`)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Nova safra</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        {safraEmAndamento && (
          <div className="flex items-start gap-2.5 rounded-xl bg-hf-amber-bg px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-amber" strokeWidth={2} />
            <div>
              <p className="m-0 text-[12.5px] font-bold text-[#5a3f0e]">
                Você já tem a {safraEmAndamento.nome} em andamento
              </p>
              <p className="m-0 mt-0.5 text-[11.5px] text-hf-amber">
                Criar uma nova safra não fecha a atual sozinha — registre um acerto final nela antes, ou os
                dois períodos vão ficar em andamento ao mesmo tempo.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Nome da safra</label>
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
            <Sprout className="h-[18px] w-[18px] shrink-0 text-hf-green-700" />
            <input
              type="text"
              placeholder="Ex: Safra 2026/2027"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
            />
          </div>
          <p className="mt-1.5 text-[11.5px] text-hf-stone-400">
            Sugerido a partir da data de hoje — pode editar livremente
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-hf-cream-100 px-3.5 py-3.5">
          <Info className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-stone-600" strokeWidth={2} />
          <p className="m-0 text-[11.5px] leading-relaxed text-hf-stone-600">
            A partir da criação, todo lançamento novo de despesa ou venda passa a pertencer a essa safra.
          </p>
        </div>
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={criar}
          disabled={!nome.trim() || salvando}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Criando...' : 'Criar e iniciar safra'}
        </button>
      </div>
    </div>
  );
}
