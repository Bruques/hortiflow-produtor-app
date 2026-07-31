import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { meRequest } from '@/services/auth';
import { listarSociosRequest } from '@/services/sociedades';
import {
  atualizarAtivoUnidadeRequest,
  criarUnidadeRequest,
  listarUnidadesRequest,
} from '@/services/unidadesVenda';
import { cn } from '@/lib/utils';
import type { UnidadeVenda } from '@/types/unidadeVenda';

export default function ConfiguracoesUnidadesVendaPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Volta de verdade no histórico do navegador em vez de empurrar uma nova entrada pra
  // cima do hub — evita o loop onde "voltar" no hub (que também usa navigate(-1)) te
  // trouxesse de volta pra esta subtela em vez de pra tela anterior ao hub.
  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/sociedades/${sociedadeId}/configuracoes`);
  }

  const [souFinanciador, setSouFinanciador] = useState(false);
  const [carregandoPapel, setCarregandoPapel] = useState(true);

  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(true);
  const [erroUnidades, setErroUnidades] = useState<string | null>(null);
  const [novaUnidadeAberta, setNovaUnidadeAberta] = useState(false);
  const [nomeNovaUnidade, setNomeNovaUnidade] = useState('');
  const [salvandoUnidade, setSalvandoUnidade] = useState(false);

  function carregarUnidades() {
    if (!sociedadeId) return;
    setCarregandoUnidades(true);
    listarUnidadesRequest(sociedadeId)
      .then((res) => setUnidades(res.unidades))
      .catch(() => setErroUnidades('Não foi possível carregar as unidades de venda'))
      .finally(() => setCarregandoUnidades(false));
  }

  useEffect(() => {
    if (!sociedadeId) return;
    carregarUnidades();
    meRequest()
      .then((res) => {
        listarSociosRequest(sociedadeId).then((r) => {
          const eu = r.socios.find((s) => s.usuario_id === res.usuario.id);
          setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
          setCarregandoPapel(false);
        });
      })
      .catch(() => setCarregandoPapel(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId]);

  async function alternarAtivoUnidade(unidade: UnidadeVenda) {
    setErroUnidades(null);
    try {
      await atualizarAtivoUnidadeRequest(unidade.id, !unidade.ativo);
      carregarUnidades();
    } catch {
      setErroUnidades('Não foi possível atualizar a unidade');
    }
  }

  async function adicionarUnidade() {
    if (!sociedadeId || !nomeNovaUnidade.trim()) return;
    setErroUnidades(null);
    setSalvandoUnidade(true);
    try {
      await criarUnidadeRequest(sociedadeId, nomeNovaUnidade.trim());
      setNomeNovaUnidade('');
      setNovaUnidadeAberta(false);
      carregarUnidades();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroUnidades(data?.error ?? 'Não foi possível criar a unidade');
    } finally {
      setSalvandoUnidade(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={voltar}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Unidades de Venda</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-7 px-[22px] py-[18px]">
        {!carregandoPapel && !souFinanciador && (
          <p className="text-center text-sm text-hf-stone-600">Apenas o financiador acessa esta seção.</p>
        )}

        {(carregandoPapel || souFinanciador) && (
          <div className="flex flex-col gap-3.5">
            <div>
              <h3 className="m-0 text-[15px] font-extrabold text-hf-stone-900">Unidades de venda</h3>
              <p className="m-0 -mt-0.5 text-xs text-hf-stone-400">Ex: Caixa, Kg — usadas ao lançar uma Venda</p>
            </div>

            {erroUnidades && <p className="text-center text-sm font-medium text-hf-red">{erroUnidades}</p>}
            {carregandoUnidades && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

            {!carregandoUnidades && (
              <div>
                {unidades.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 border-b border-hf-cream-100 py-2.5 last:border-b-0">
                    <span className="text-sm font-bold text-hf-stone-900">{u.nome}</span>
                    <button
                      type="button"
                      aria-label={u.ativo ? `Desativar unidade ${u.nome}` : `Ativar unidade ${u.nome}`}
                      onClick={() => alternarAtivoUnidade(u)}
                      className={cn(
                        'relative h-6 w-[42px] shrink-0 rounded-full transition-colors',
                        u.ativo ? 'bg-hf-green-700' : 'bg-hf-line'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                          u.ativo ? 'left-[20px]' : 'left-0.5'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!novaUnidadeAberta && (
              <button
                type="button"
                onClick={() => setNovaUnidadeAberta(true)}
                className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-[13.5px] font-bold text-hf-green-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Nova unidade
              </button>
            )}

            {novaUnidadeAberta && (
              <div className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Nome da unidade</label>
                  <input
                    type="text"
                    value={nomeNovaUnidade}
                    onChange={(e) => setNomeNovaUnidade(e.target.value)}
                    placeholder="Ex: Kg"
                    className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNovaUnidadeAberta(false)}
                    className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={adicionarUnidade}
                    disabled={salvandoUnidade || !nomeNovaUnidade.trim()}
                    className="flex-1 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    {salvandoUnidade ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
