import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Check, AlertTriangle, Copy, Pencil, Trash2, X } from 'lucide-react';
import {
  criarSocioNaSafraRequest,
  atualizarPercentuaisSafraRequest,
  listarSociosDaSafraRequest,
  obterSafraRequest,
  removerSocioDaSafraRequest,
} from '@/services/safras';
import { editarNomeSocioRequest, listarSociedadesRequest, listarSociosCatalogoRequest } from '@/services/sociedades';
import { cn, iniciais } from '@/lib/utils';
import type { PapelSocio, Socio, SocioCatalogo } from '@/types/sociedade';

const CORES_BARRA = ['bg-hf-green-800', 'bg-hf-green-600', 'bg-hf-amber', 'bg-hf-blue'];

interface EdicaoSocio {
  id: string;
  usuario_id: string | null;
  nome: string;
  percentual_lucro: number;
  papel: PapelSocio;
}

// Task 23, incremento — sócios/percentuais são por Safra, então esta tela (chegada a partir
// do Menu de uma safra específica) passou de "sócios da sociedade inteira" pra "sócios desta
// safra": mostra e edita só quem participa da safra selecionada, não mais o catálogo inteiro
// da sociedade (docs/specs/23-socios-por-safra.md).
export default function ConfiguracoesSociosPage() {
  const { id: safraId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [sociedadeId, setSociedadeId] = useState<string | null>(null);

  // Volta de verdade no histórico do navegador (chegou aqui a partir do Menu) — só cai
  // numa rota fixa quando não há histórico (link direto, refresh).
  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate(sociedadeId ? `/sociedades/${sociedadeId}/safras` : '/');
  }

  const [edicoes, setEdicoes] = useState<EdicaoSocio[]>([]);
  const [carregandoSocios, setCarregandoSocios] = useState(true);
  const [salvandoPct, setSalvandoPct] = useState(false);
  const [erroPct, setErroPct] = useState<string | null>(null);
  const [sucessoPct, setSucessoPct] = useState(false);

  const [codigoConvite, setCodigoConvite] = useState<string | null>(null);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  const [catalogo, setCatalogo] = useState<SocioCatalogo[]>([]);
  const [novoSocioAberto, setNovoSocioAberto] = useState(false);
  const [modoNovo, setModoNovo] = useState<'existente' | 'novo'>('novo');
  const [socioExistenteId, setSocioExistenteId] = useState('');
  const [nomeNovoSocio, setNomeNovoSocio] = useState('');
  const [papelNovoSocio, setPapelNovoSocio] = useState<PapelSocio>('MEEIRO');
  const [salvandoNovoSocio, setSalvandoNovoSocio] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [erroAcaoSocio, setErroAcaoSocio] = useState<string | null>(null);

  function carregarSocios() {
    if (!safraId) return;
    setCarregandoSocios(true);
    listarSociosDaSafraRequest(safraId)
      .then((res) => {
        setEdicoes(
          res.socios.map((s: Socio) => ({
            id: s.id,
            usuario_id: s.usuario_id,
            nome: s.nome,
            percentual_lucro: Number(s.percentual_lucro),
            papel: s.papel,
          }))
        );
      })
      .catch(() => setErroPct('Não foi possível carregar os sócios'))
      .finally(() => setCarregandoSocios(false));
  }

  useEffect(() => {
    carregarSocios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safraId]);

  useEffect(() => {
    if (!safraId) return;
    obterSafraRequest(safraId)
      .then((res) => setSociedadeId(res.safra.sociedade_id))
      .catch(() => {});
  }, [safraId]);

  useEffect(() => {
    if (!sociedadeId) return;
    listarSociedadesRequest()
      .then((res) => {
        const minhaSociedade = res.sociedades.find((s) => s.id === sociedadeId);
        setCodigoConvite(minhaSociedade?.codigo_convite ?? null);
      })
      .catch(() => {});
    listarSociosCatalogoRequest(sociedadeId)
      .then((res) => setCatalogo(res.socios))
      .catch(() => {});
  }, [sociedadeId]);

  async function copiarCodigo() {
    if (!codigoConvite) return;
    await navigator.clipboard.writeText(codigoConvite);
    setCodigoCopiado(true);
    setTimeout(() => setCodigoCopiado(false), 2000);
  }

  function ajustarPct(socioId: string, delta: number) {
    setSucessoPct(false);
    setEdicoes((atual) =>
      atual.map((s) =>
        s.id === socioId
          ? { ...s, percentual_lucro: Math.max(0, Math.min(100, s.percentual_lucro + delta)) }
          : s
      )
    );
  }

  const somaPct = edicoes.reduce((acc, s) => acc + s.percentual_lucro, 0);
  const pctOk = Math.abs(somaPct - 100) < 0.01;
  const catalogoDisponivel = catalogo.filter((c) => !edicoes.some((e) => e.id === c.id));

  async function salvarPercentuais() {
    if (!safraId) return;
    setErroPct(null);
    setSucessoPct(false);
    setSalvandoPct(true);
    try {
      await atualizarPercentuaisSafraRequest(
        safraId,
        edicoes.map((s) => ({ socio_sociedade_id: s.id, percentual_lucro: s.percentual_lucro }))
      );
      setSucessoPct(true);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroPct(data?.error ?? 'Não foi possível salvar os percentuais');
    } finally {
      setSalvandoPct(false);
    }
  }

  async function adicionarSocio() {
    if (!safraId) return;
    if (modoNovo === 'existente' && !socioExistenteId) return;
    if (modoNovo === 'novo' && !nomeNovoSocio.trim()) return;

    setErroPct(null);
    setSalvandoNovoSocio(true);
    try {
      await criarSocioNaSafraRequest(
        safraId,
        modoNovo === 'existente'
          ? { socio_sociedade_id: socioExistenteId }
          : { nome: nomeNovoSocio.trim(), papel: papelNovoSocio }
      );
      setNomeNovoSocio('');
      setPapelNovoSocio('MEEIRO');
      setSocioExistenteId('');
      setNovoSocioAberto(false);
      carregarSocios();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroPct(data?.error ?? 'Não foi possível adicionar o sócio');
    } finally {
      setSalvandoNovoSocio(false);
    }
  }

  function iniciarEdicaoNome(socio: EdicaoSocio) {
    setErroAcaoSocio(null);
    setEditandoId(socio.id);
    setNomeEmEdicao(socio.nome);
  }

  async function salvarNomeSocio(socioId: string) {
    if (!sociedadeId || !nomeEmEdicao.trim()) return;
    setErroAcaoSocio(null);
    setSalvandoNome(true);
    try {
      await editarNomeSocioRequest(sociedadeId, socioId, nomeEmEdicao.trim());
      setEditandoId(null);
      carregarSocios();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroAcaoSocio(data?.error ?? 'Não foi possível editar o nome do sócio');
    } finally {
      setSalvandoNome(false);
    }
  }

  async function removerSocio(socio: EdicaoSocio) {
    if (!safraId) return;
    if (!window.confirm(`Remover ${socio.nome} desta safra? Essa ação não pode ser desfeita.`)) return;
    setErroAcaoSocio(null);
    setRemovendoId(socio.id);
    try {
      await removerSocioDaSafraRequest(safraId, socio.id);
      carregarSocios();
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroAcaoSocio(data?.error ?? 'Não foi possível remover o sócio');
    } finally {
      setRemovendoId(null);
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
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Sócios da safra</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-7 px-[22px] py-[18px]">
        <div className="flex flex-col gap-3.5">
          <div>
            <h3 className="m-0 text-[15px] font-extrabold text-hf-stone-900">Percentual de lucro</h3>
            <p className="m-0 -mt-0.5 text-xs text-hf-stone-400">
              Vale só pra esta safra — a soma precisa fechar em 100%
            </p>
          </div>

          {carregandoSocios && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

          {!carregandoSocios && edicoes.length > 0 && (
            <>
              <div className="flex h-3.5 overflow-hidden rounded-full bg-hf-cream-100">
                {edicoes.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn('transition-all', CORES_BARRA[i % CORES_BARRA.length])}
                    style={{ width: `${s.percentual_lucro}%` }}
                  />
                ))}
              </div>

              <div
                className={cn(
                  'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold',
                  pctOk ? 'bg-hf-green-100 text-hf-green-700' : 'bg-hf-red-bg text-hf-red'
                )}
              >
                {pctOk ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />}
                Total: {somaPct.toFixed(somaPct % 1 === 0 ? 0 : 2)}%
              </div>

              <div>
                {edicoes.map((s) => (
                  <div key={s.id} className="flex flex-col gap-2 border-b border-hf-cream-100 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-hf-green-100 text-[13px] font-extrabold text-hf-green-800">
                          {iniciais(s.nome)}
                        </div>
                        <div className="min-w-0">
                          {editandoId === s.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={nomeEmEdicao}
                              onChange={(e) => setNomeEmEdicao(e.target.value)}
                              className="h-8 w-full max-w-[160px] rounded-lg border border-hf-green-500 bg-white px-2 text-sm font-bold outline-none"
                            />
                          ) : (
                            <p className="m-0 truncate text-sm font-bold text-hf-stone-900">{s.nome}</p>
                          )}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <span className="inline-block rounded-full bg-hf-green-100 px-1.5 py-0.5 text-[10px] font-bold text-hf-green-700">
                              {s.papel === 'FINANCIADOR' ? 'Financiador' : s.papel === 'MEEIRO' ? 'Meeiro' : 'Misto'}
                            </span>
                            {!s.usuario_id && (
                              <span className="inline-block rounded-full bg-hf-cream-100 px-1.5 py-0.5 text-[10px] font-bold text-hf-stone-400">
                                Sem conta
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <button
                          type="button"
                          aria-label={`Diminuir percentual de ${s.nome}`}
                          onClick={() => ajustarPct(s.id, -5)}
                          className="flex h-[27px] w-[27px] items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                        <span className="min-w-[42px] text-center text-[15px] font-extrabold tabular-nums text-hf-stone-900">
                          {s.percentual_lucro}%
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar percentual de ${s.nome}`}
                          onClick={() => ajustarPct(s.id, 5)}
                          className="flex h-[27px] w-[27px] items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editandoId === s.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => salvarNomeSocio(s.id)}
                            disabled={salvandoNome || !nomeEmEdicao.trim()}
                            className="flex items-center gap-1 rounded-full bg-hf-green-800 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" strokeWidth={2.6} />
                            {salvandoNome ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditandoId(null)}
                            disabled={salvandoNome}
                            className="flex items-center gap-1 rounded-full border border-hf-line px-2.5 py-1 text-[11px] font-bold text-hf-stone-700"
                          >
                            <X className="h-3 w-3" strokeWidth={2.6} />
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          {!s.usuario_id && (
                            <button
                              type="button"
                              aria-label={`Editar nome de ${s.nome}`}
                              onClick={() => iniciarEdicaoNome(s)}
                              className="flex items-center gap-1 rounded-full border border-hf-line px-2.5 py-1 text-[11px] font-bold text-hf-stone-700"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={2.4} />
                              Editar nome
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Remover ${s.nome}`}
                            onClick={() => removerSocio(s)}
                            disabled={removendoId === s.id}
                            className="flex items-center gap-1 rounded-full border border-hf-red px-2.5 py-1 text-[11px] font-bold text-hf-red disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                            {removendoId === s.id ? 'Removendo...' : 'Remover'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {erroAcaoSocio && <p className="text-center text-sm font-medium text-hf-red">{erroAcaoSocio}</p>}
            </>
          )}

          {!novoSocioAberto && (
            <button
              type="button"
              onClick={() => setNovoSocioAberto(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-[13.5px] font-bold text-hf-green-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Adicionar sócio
            </button>
          )}

          {novoSocioAberto && (
            <div className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoNovo('existente')}
                  disabled={catalogoDisponivel.length === 0}
                  className={cn(
                    'flex-1 rounded-xl border-[1.5px] py-2 text-[12px] font-bold disabled:opacity-40',
                    modoNovo === 'existente' ? 'border-hf-green-500 bg-hf-green-100 text-hf-green-800' : 'border-hf-line text-hf-stone-700'
                  )}
                >
                  Sócio já cadastrado
                </button>
                <button
                  type="button"
                  onClick={() => setModoNovo('novo')}
                  className={cn(
                    'flex-1 rounded-xl border-[1.5px] py-2 text-[12px] font-bold',
                    modoNovo === 'novo' ? 'border-hf-green-500 bg-hf-green-100 text-hf-green-800' : 'border-hf-line text-hf-stone-700'
                  )}
                >
                  Sócio novo
                </button>
              </div>

              {modoNovo === 'existente' ? (
                catalogoDisponivel.length === 0 ? (
                  <p className="m-0 text-xs text-hf-stone-400">
                    Nenhum outro sócio cadastrado nessa sociedade ainda — cadastre um novo.
                  </p>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Sócio</label>
                    <select
                      className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
                      value={socioExistenteId}
                      onChange={(e) => setSocioExistenteId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {catalogoDisponivel.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Nome do sócio</label>
                    <input
                      type="text"
                      value={nomeNovoSocio}
                      onChange={(e) => setNomeNovoSocio(e.target.value)}
                      placeholder="Ex: João"
                      className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Papel</label>
                    <select
                      className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
                      value={papelNovoSocio}
                      onChange={(e) => setPapelNovoSocio(e.target.value as PapelSocio)}
                    >
                      <option value="MEEIRO">Meeiro</option>
                      <option value="FINANCIADOR">Financiador</option>
                      <option value="MISTO">Misto</option>
                    </select>
                  </div>
                </>
              )}

              <p className="m-0 text-xs text-hf-stone-400">
                Entra com 0% — ajuste o percentual de todos depois de adicionar.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNovoSocioAberto(false)}
                  className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={adicionarSocio}
                  disabled={salvandoNovoSocio || (modoNovo === 'existente' ? !socioExistenteId : !nomeNovoSocio.trim())}
                  className="flex-1 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {salvandoNovoSocio ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}

          {erroPct && <p className="text-center text-sm font-medium text-hf-red">{erroPct}</p>}
          {sucessoPct && <p className="text-center text-sm font-medium text-hf-green-700">Percentuais atualizados!</p>}

          {codigoConvite && (
            <div className="flex items-center justify-between rounded-2xl bg-hf-cream-100 px-4 py-3.5">
              <div>
                <div className="text-xl font-extrabold tracking-[0.18em] tabular-nums text-hf-stone-900">
                  {codigoConvite.slice(0, 3)} {codigoConvite.slice(3)}
                </div>
                <div className="mt-0.5 text-[11px] text-hf-stone-400">
                  {codigoCopiado ? 'Copiado!' : 'Código para um novo sócio entrar na sociedade'}
                </div>
              </div>
              <button
                type="button"
                aria-label="Copiar código"
                onClick={copiarCodigo}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border-[1.5px] border-hf-line bg-white text-hf-green-800"
              >
                <Copy className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvarPercentuais}
          disabled={salvandoPct || edicoes.length === 0}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvandoPct ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
