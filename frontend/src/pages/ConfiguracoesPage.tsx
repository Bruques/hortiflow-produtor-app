import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Check, AlertTriangle, Copy } from 'lucide-react';
import { meRequest } from '@/services/auth';
import { atualizarPercentuaisRequest, listarSociedadesRequest, listarSociosRequest } from '@/services/sociedades';
import {
  atualizarAtivoRequest,
  criarRegraRequest,
  listarRegrasRequest,
} from '@/services/regrasDespesaRecorrente';
import { cn, formatarMoeda, iniciais } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { PapelSocio, Socio } from '@/types/sociedade';
import type { RegraDespesaRecorrente, TipoGatilhoRegra } from '@/types/regraDespesaRecorrente';
import type { TipoDespesa } from '@/types/despesa';

// Cores do gráfico de proporção, na ordem dos sócios retornados pela API — cicla se houver
// mais de 4 (raro no domínio, mas evita quebrar em vez de travar num índice fora do array).
const CORES_BARRA = ['bg-hf-green-800', 'bg-hf-green-600', 'bg-hf-amber', 'bg-hf-blue'];

interface EdicaoSocio {
  usuario_id: string;
  nome: string;
  percentual_lucro: number;
  papel: PapelSocio;
}

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

export default function ConfiguracoesPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [edicoes, setEdicoes] = useState<EdicaoSocio[]>([]);
  const [carregandoSocios, setCarregandoSocios] = useState(true);
  const [salvandoPct, setSalvandoPct] = useState(false);
  const [erroPct, setErroPct] = useState<string | null>(null);
  const [sucessoPct, setSucessoPct] = useState(false);

  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);
  const [carregandoRegras, setCarregandoRegras] = useState(true);
  const [souFinanciador, setSouFinanciador] = useState(false);
  const [erroRegras, setErroRegras] = useState<string | null>(null);

  const [codigoConvite, setCodigoConvite] = useState<string | null>(null);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  const [novaRegraAberta, setNovaRegraAberta] = useState(false);
  const [socioRegra, setSocioRegra] = useState('');
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoRegra>('POR_VENDA');
  const [tipoDespesaRegra, setTipoDespesaRegra] = useState<TipoDespesa>('OUTRO');
  const [valorRegra, setValorRegra] = useState('');
  const [salvandoRegra, setSalvandoRegra] = useState(false);

  function carregarSocios() {
    if (!sociedadeId) return;
    setCarregandoSocios(true);
    listarSociosRequest(sociedadeId)
      .then((res) => {
        setEdicoes(
          res.socios.map((s: Socio) => ({
            usuario_id: s.usuario_id,
            nome: s.nome,
            percentual_lucro: Number(s.percentual_lucro),
            papel: s.papel,
          }))
        );
        if (res.socios.length > 0) setSocioRegra(res.socios[0].usuario_id);
      })
      .catch(() => setErroPct('Não foi possível carregar os sócios'))
      .finally(() => setCarregandoSocios(false));
  }

  function carregarRegras() {
    if (!sociedadeId) return;
    setCarregandoRegras(true);
    listarRegrasRequest(sociedadeId)
      .then((res) => setRegras(res.regras))
      .catch(() => setErroRegras('Não foi possível carregar as regras'))
      .finally(() => setCarregandoRegras(false));
  }

  useEffect(() => {
    carregarSocios();
    carregarRegras();
    meRequest()
      .then((res) => {
        listarSociosRequest(sociedadeId!).then((r) => {
          const eu = r.socios.find((s) => s.usuario_id === res.usuario.id);
          setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
        });
      })
      .catch(() => {});
    listarSociedadesRequest()
      .then((res) => {
        const minhaSociedade = res.sociedades.find((s) => s.id === sociedadeId);
        setCodigoConvite(minhaSociedade?.codigo_convite ?? null);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId]);

  async function copiarCodigo() {
    if (!codigoConvite) return;
    await navigator.clipboard.writeText(codigoConvite);
    setCodigoCopiado(true);
    setTimeout(() => setCodigoCopiado(false), 2000);
  }

  function ajustarPct(usuarioId: string, delta: number) {
    setSucessoPct(false);
    setEdicoes((atual) =>
      atual.map((s) =>
        s.usuario_id === usuarioId
          ? { ...s, percentual_lucro: Math.max(0, Math.min(100, s.percentual_lucro + delta)) }
          : s
      )
    );
  }

  const somaPct = edicoes.reduce((acc, s) => acc + s.percentual_lucro, 0);
  const pctOk = Math.abs(somaPct - 100) < 0.01;

  async function salvarPercentuais() {
    if (!sociedadeId) return;
    setErroPct(null);
    setSucessoPct(false);
    setSalvandoPct(true);
    try {
      await atualizarPercentuaisRequest(
        sociedadeId,
        edicoes.map((s) => ({ usuario_id: s.usuario_id, percentual_lucro: s.percentual_lucro, papel: s.papel }))
      );
      setSucessoPct(true);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroPct(data?.error ?? 'Não foi possível salvar os percentuais');
    } finally {
      setSalvandoPct(false);
    }
  }

  async function alternarAtivo(regra: RegraDespesaRecorrente) {
    setErroRegras(null);
    try {
      await atualizarAtivoRequest(regra.id, !regra.ativo);
      carregarRegras();
    } catch {
      setErroRegras('Não foi possível atualizar a regra');
    }
  }

  async function criarRegra() {
    if (!sociedadeId || !socioRegra || !valorRegra) return;
    setErroRegras(null);
    setSalvandoRegra(true);
    try {
      await criarRegraRequest(sociedadeId, {
        socio_id: socioRegra,
        tipo_gatilho: tipoGatilho,
        tipo_despesa: tipoDespesaRegra,
        valor: Number(valorRegra),
      });
      setValorRegra('');
      setNovaRegraAberta(false);
      carregarRegras();
    } catch {
      setErroRegras('Não foi possível criar a regra');
    } finally {
      setSalvandoRegra(false);
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
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Configurações</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-7 px-[22px] py-[18px]">
        <div className="flex flex-col gap-3.5">
          <div>
            <h3 className="m-0 text-[15px] font-extrabold text-hf-stone-900">Sócios e percentual de lucro</h3>
            <p className="m-0 -mt-0.5 text-xs text-hf-stone-400">A soma precisa fechar em 100%</p>
          </div>

          {carregandoSocios && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

          {!carregandoSocios && edicoes.length > 0 && (
            <>
              <div className="flex h-3.5 overflow-hidden rounded-full bg-hf-cream-100">
                {edicoes.map((s, i) => (
                  <div
                    key={s.usuario_id}
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
                  <div key={s.usuario_id} className="flex items-center justify-between gap-2 border-b border-hf-cream-100 py-3 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-hf-green-100 text-[13px] font-extrabold text-hf-green-800">
                        {iniciais(s.nome)}
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-bold text-hf-stone-900">{s.nome}</p>
                        <span className="mt-0.5 inline-block rounded-full bg-hf-green-100 px-1.5 py-0.5 text-[10px] font-bold text-hf-green-700">
                          {s.papel === 'FINANCIADOR' ? 'Financiador' : s.papel === 'MEEIRO' ? 'Meeiro' : 'Misto'}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <button
                        type="button"
                        aria-label={`Diminuir percentual de ${s.nome}`}
                        onClick={() => ajustarPct(s.usuario_id, -5)}
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
                        onClick={() => ajustarPct(s.usuario_id, 5)}
                        className="flex h-[27px] w-[27px] items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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

        <div className="flex flex-col gap-3.5">
          <div>
            <h3 className="m-0 text-[15px] font-extrabold text-hf-stone-900">Despesa recorrente</h3>
            <p className="m-0 -mt-0.5 text-xs text-hf-stone-400">Só o financiador cria ou edita regras</p>
          </div>

          {erroRegras && <p className="text-center text-sm font-medium text-hf-red">{erroRegras}</p>}
          {carregandoRegras && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}
          {!carregandoRegras && regras.length === 0 && (
            <p className="text-center text-sm text-hf-stone-600">Nenhuma regra criada ainda.</p>
          )}

          {regras.map((r) => {
            const Icone = ICONE_TIPO_DESPESA[r.tipo_despesa];
            const porVenda = r.tipo_gatilho === 'POR_VENDA';
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-hf-line p-3.5">
                <div className={cn('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl', porVenda ? 'bg-hf-green-100' : 'bg-hf-amber-bg')}>
                  <Icone className={cn('h-[18px] w-[18px]', porVenda ? 'text-hf-green-600' : 'text-hf-amber')} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13.5px] font-bold text-hf-stone-900">
                    {formatarMoeda(Number(r.valor))} {porVenda ? 'por caixa vendida' : `· ${ROTULO_TIPO_DESPESA[r.tipo_despesa]}`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        porVenda ? 'bg-hf-green-100 text-hf-green-600' : 'bg-hf-amber-bg text-hf-amber'
                      )}
                    >
                      {porVenda ? 'Por venda' : 'Por período · sugestão'}
                    </span>
                    <span className="text-[11px] text-hf-stone-400">Atribuído a: {r.socio_nome}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={r.ativo ? 'Desativar regra' : 'Ativar regra'}
                  disabled={!souFinanciador}
                  onClick={() => alternarAtivo(r)}
                  className={cn(
                    'relative h-6 w-[42px] shrink-0 rounded-full transition-colors disabled:opacity-60',
                    r.ativo ? 'bg-hf-green-700' : 'bg-hf-line'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      r.ativo ? 'left-[20px]' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            );
          })}

          {souFinanciador && !novaRegraAberta && (
            <button
              type="button"
              onClick={() => setNovaRegraAberta(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-[13.5px] font-bold text-hf-green-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Nova regra
            </button>
          )}

          {souFinanciador && novaRegraAberta && (
            <div className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Sócio (recebe a despesa)</label>
                <select
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-sm"
                  value={socioRegra}
                  onChange={(e) => setSocioRegra(e.target.value)}
                >
                  {edicoes.map((s) => (
                    <option key={s.usuario_id} value={s.usuario_id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Gatilho</label>
                <select
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-sm"
                  value={tipoGatilho}
                  onChange={(e) => setTipoGatilho(e.target.value as TipoGatilhoRegra)}
                >
                  <option value="POR_VENDA">Por venda (valor por caixa)</option>
                  <option value="POR_PERIODO">Por período (valor fixo recorrente)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Tipo de despesa gerada</label>
                <select
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-sm"
                  value={tipoDespesaRegra}
                  onChange={(e) => setTipoDespesaRegra(e.target.value as TipoDespesa)}
                >
                  {TIPOS_DESPESA.map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO_DESPESA[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">
                  {tipoGatilho === 'POR_VENDA' ? 'Valor por caixa (R$)' : 'Valor fixo (R$)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={valorRegra}
                  onChange={(e) => setValorRegra(e.target.value)}
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-sm outline-none focus:border-hf-green-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNovaRegraAberta(false)}
                  className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarRegra}
                  disabled={salvandoRegra || !socioRegra || !valorRegra}
                  className="flex-1 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {salvandoRegra ? 'Criando...' : 'Criar regra'}
                </button>
              </div>
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
