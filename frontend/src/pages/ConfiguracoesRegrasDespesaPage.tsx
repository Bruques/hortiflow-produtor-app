import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, Percent, Plus, SlidersHorizontal, User } from 'lucide-react';
import { meRequest } from '@/services/auth';
import { listarSociosRequest } from '@/services/sociedades';
import {
  atualizarAtivoRequest,
  atualizarRegraRequest,
  criarRegraRequest,
  listarRegrasRequest,
} from '@/services/regrasDespesaRecorrente';
import { listarUnidadesRequest } from '@/services/unidadesVenda';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { cn, formatarMoeda, iniciais } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { Socio } from '@/types/sociedade';
import type { RegraDespesaRecorrente, TipoGatilhoRegra } from '@/types/regraDespesaRecorrente';
import type { TipoDespesa } from '@/types/despesa';
import type { UnidadeVenda } from '@/types/unidadeVenda';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

// Divide 100% em `n` fatias, todas múltiplas de 5, o mais igual possível — ponto de partida
// do rateio personalizado, pra fechar em 100% usando só os botões de +5/-5 (mesmo ajuste de
// frontend/src/pages/NovaDespesaPage.tsx, bug relatado 2026-08-27).
function splitPercentuaisMultiplosDe5(n: number): number[] {
  const totalFatias = 20; // 100% ÷ 5
  const base = Math.floor(totalFatias / n);
  const resto = totalFatias - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) * 5);
}

// Máscara estilo apps de banco (Pix): usuário só digita números, e o valor se monta da direita
// pra esquerda (centavos primeiro) — "1" -> 0,01, "12345" -> 123,45. O estado guarda só os
// dígitos brutos (centavos); a formatação com pontos/vírgula é derivada na hora de exibir.
// Mesmo padrão usado em NovaDespesaPage e NovaVendaPage.
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

type ModoRateio = 'padrao' | 'exclusivo' | 'personalizado';

const CORES_RATEIO = [
  { seg: '#17482d', bg: '#e3f3e2', texto: '#17482d' },
  { seg: '#3b9b5e', bg: '#eef6ee', texto: '#278049' },
  { seg: '#c98a1f', bg: '#faedd0', texto: '#c98a1f' },
  { seg: '#2f6fd6', bg: '#e2edfb', texto: '#2f6fd6' },
];

const MODOS_RATEIO: { modo: ModoRateio; titulo: string; sub: string; Icone: typeof Percent }[] = [
  { modo: 'padrao', titulo: 'Dividir como o lucro', sub: 'Mesmo percentual combinado entre os sócios', Icone: Percent },
  { modo: 'exclusivo', titulo: 'Só de um sócio', sub: 'Um único sócio arca com 100% dessa despesa', Icone: User },
  { modo: 'personalizado', titulo: 'Personalizado', sub: 'Você define o percentual de cada sócio', Icone: SlidersHorizontal },
];

export default function ConfiguracoesRegrasDespesaPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Volta de verdade no histórico do navegador (chegou aqui a partir do Menu) — só cai
  // numa rota fixa quando não há histórico (link direto, refresh).
  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/sociedades/${sociedadeId}/safras`);
  }

  const [socios, setSocios] = useState<Socio[]>([]);
  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);
  const [carregandoRegras, setCarregandoRegras] = useState(true);
  const [souFinanciador, setSouFinanciador] = useState(false);
  const [erroRegras, setErroRegras] = useState<string | null>(null);

  const [novaRegraAberta, setNovaRegraAberta] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoRegra>('POR_VENDA');
  const [tipoDespesaRegra, setTipoDespesaRegra] = useState<TipoDespesa>('OUTRO');
  const [valorRegraCentavos, setValorRegraCentavos] = useState(''); // só dígitos, sem formatação
  const [unidadeRegra, setUnidadeRegra] = useState('');
  const [salvandoRegra, setSalvandoRegra] = useState(false);
  const [modoRateio, setModoRateio] = useState<ModoRateio>('padrao');
  const [rateioExclusivoId, setRateioExclusivoId] = useState('');
  const [rateioPercentuais, setRateioPercentuais] = useState<Record<string, string>>({});

  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);

  function carregarRegras() {
    if (!sociedadeId) return;
    setCarregandoRegras(true);
    listarRegrasRequest(sociedadeId)
      .then((res) => setRegras(res.regras))
      .catch(() => setErroRegras('Não foi possível carregar as regras'))
      .finally(() => setCarregandoRegras(false));
  }

  useEffect(() => {
    if (!sociedadeId) return;
    carregarRegras();
    listarSociosRequest(sociedadeId).then((res) => {
      setSocios(res.socios);
      if (res.socios.length > 0) setRateioExclusivoId(res.socios[0].id);
    });
    listarUnidadesRequest(sociedadeId).then((res) => {
      setUnidades(res.unidades);
      const primeiraAtiva = res.unidades.find((u) => u.ativo);
      if (primeiraAtiva) setUnidadeRegra((atual) => atual || primeiraAtiva.id);
    });
    meRequest()
      .then((res) => {
        listarSociosRequest(sociedadeId).then((r) => {
          const eu = r.socios.find((s) => s.usuario_id === res.usuario.id);
          setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId]);

  async function alternarAtivo(regra: RegraDespesaRecorrente) {
    setErroRegras(null);
    try {
      await atualizarAtivoRequest(regra.id, !regra.ativo);
      carregarRegras();
    } catch {
      setErroRegras('Não foi possível atualizar a regra');
    }
  }

  const somaRateioPersonalizado = socios.reduce(
    (acc, s) => acc + (Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0),
    0
  );
  const rateioValido =
    modoRateio === 'padrao' ||
    (modoRateio === 'exclusivo' && !!rateioExclusivoId) ||
    (modoRateio === 'personalizado' && Math.abs(somaRateioPersonalizado - 100) <= 0.01);

  function alterarValorRegra(texto: string) {
    setValorRegraCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const valorRegraNumero = valorRegraCentavos ? Number(valorRegraCentavos) / 100 : 0;

  function selecionarPersonalizado() {
    setModoRateio('personalizado');
    if (Object.keys(rateioPercentuais).length === 0 && socios.length > 0) {
      const fatias = splitPercentuaisMultiplosDe5(socios.length);
      setRateioPercentuais(Object.fromEntries(socios.map((s, i) => [s.id, String(fatias[i])])));
    }
  }

  function ajustarPercentual(socioId: string, delta: number) {
    setRateioPercentuais((atual) => {
      const valorAtual = Number(atual[socioId]?.replace(',', '.')) || 0;
      const novoValor = Math.min(100, Math.max(0, valorAtual + delta));
      return { ...atual, [socioId]: String(novoValor) };
    });
  }

  function rateioParaEnviar(): { socio_id: string; percentual: number }[] | undefined {
    if (modoRateio === 'padrao') return undefined;
    if (modoRateio === 'exclusivo') return [{ socio_id: rateioExclusivoId, percentual: 100 }];
    return socios
      .map((s) => ({ socio_id: s.id, percentual: Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
      .filter((r) => r.percentual > 0);
  }

  function fecharFormulario() {
    setNovaRegraAberta(false);
    setEditandoId(null);
    setValorRegraCentavos('');
    setModoRateio('padrao');
    setRateioPercentuais({});
  }

  function abrirEdicao(regra: RegraDespesaRecorrente) {
    setErroRegras(null);
    setEditandoId(regra.id);
    setTipoGatilho(regra.tipo_gatilho);
    setTipoDespesaRegra(regra.tipo_despesa);
    setValorRegraCentavos(String(Math.round(Number(regra.valor) * 100)));
    setUnidadeRegra(regra.unidade_id ?? '');
    if (!regra.rateio) {
      setModoRateio('padrao');
      setRateioPercentuais({});
    } else if (regra.rateio.length === 1) {
      setModoRateio('exclusivo');
      setRateioExclusivoId(regra.rateio[0].socio_id);
    } else {
      setModoRateio('personalizado');
      setRateioPercentuais(Object.fromEntries(regra.rateio.map((r) => [r.socio_id, String(r.percentual)])));
    }
    setNovaRegraAberta(true);
  }

  async function salvarRegra() {
    if (!sociedadeId || !valorRegraCentavos || !rateioValido) return;
    if (tipoGatilho === 'POR_VENDA' && !unidadeRegra) return;
    setErroRegras(null);
    setSalvandoRegra(true);
    try {
      if (editandoId) {
        await atualizarRegraRequest(editandoId, {
          tipo_despesa: tipoDespesaRegra,
          valor: valorRegraNumero,
          unidade_id: tipoGatilho === 'POR_VENDA' ? unidadeRegra : undefined,
          rateio: rateioParaEnviar(),
        });
      } else {
        await criarRegraRequest(sociedadeId, {
          tipo_gatilho: tipoGatilho,
          tipo_despesa: tipoDespesaRegra,
          valor: valorRegraNumero,
          unidade_id: tipoGatilho === 'POR_VENDA' ? unidadeRegra : undefined,
          rateio: rateioParaEnviar(),
        });
      }
      fecharFormulario();
      carregarRegras();
    } catch {
      setErroRegras(editandoId ? 'Não foi possível salvar a regra' : 'Não foi possível criar a regra');
    } finally {
      setSalvandoRegra(false);
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
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Regras de Despesa</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-7 px-[22px] py-[18px]">
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
                    {formatarMoeda(Number(r.valor))}{' '}
                    {porVenda ? `por ${r.unidade_nome?.toLowerCase() ?? 'unidade'} vendida` : `· ${ROTULO_TIPO_DESPESA[r.tipo_despesa]}`}
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
                    {r.rateio && (
                      <span className="rounded-full bg-hf-cream-100 px-2 py-0.5 text-[10px] font-bold text-hf-stone-600">
                        {r.rateio.length === 1
                          ? `Rateio: só ${r.rateio[0].socio_nome}`
                          : 'Rateio personalizado'}
                      </span>
                    )}
                  </div>
                </div>
                {souFinanciador && (
                  <button
                    type="button"
                    aria-label="Editar regra"
                    onClick={() => abrirEdicao(r)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-stone-600"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                )}
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

          {souFinanciador && (
            <button
              type="button"
              onClick={() => setNovaRegraAberta(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-[13.5px] font-bold text-hf-green-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Nova regra
            </button>
          )}

          <BottomSheet aberto={souFinanciador && novaRegraAberta} onFechar={fecharFormulario}>
            <h4 className="m-0 shrink-0 pb-3 text-[13px] font-extrabold text-hf-stone-900">
              {editandoId ? 'Editar regra' : 'Nova regra'}
            </h4>
            <div className="flex flex-col gap-3 overflow-y-auto pb-1">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Gatilho</label>
                <select
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base disabled:bg-hf-cream-100 disabled:text-hf-stone-500"
                  value={tipoGatilho}
                  disabled={!!editandoId}
                  onChange={(e) => setTipoGatilho(e.target.value as TipoGatilhoRegra)}
                >
                  <option value="POR_VENDA">Por venda (valor por unidade)</option>
                  <option value="POR_PERIODO">Por período (valor fixo recorrente)</option>
                </select>
                {editandoId && (
                  <p className="m-0 mt-1.5 text-xs text-hf-stone-400">
                    O gatilho não pode ser alterado — desative essa regra e crie outra se precisar mudar.
                  </p>
                )}
              </div>
              {tipoGatilho === 'POR_VENDA' && (
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Unidade</label>
                  <select
                    className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
                    value={unidadeRegra}
                    onChange={(e) => setUnidadeRegra(e.target.value)}
                  >
                    {unidades.filter((u) => u.ativo).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                  {unidades.filter((u) => u.ativo).length === 0 && (
                    <p className="m-0 mt-1.5 text-xs text-hf-red">Cadastre uma unidade de venda antes de criar essa regra.</p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Tipo de despesa gerada</label>
                <select
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
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
                  {tipoGatilho === 'POR_VENDA' ? 'Valor por unidade (R$)' : 'Valor fixo (R$)'}
                </label>
                <div className="flex h-11 w-full items-center gap-1.5 rounded-xl border border-hf-line bg-white px-3 focus-within:border-hf-green-500">
                  <span className="text-base font-bold text-hf-stone-500">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatarValorMascara(valorRegraCentavos)}
                    onChange={(e) => alterarValorRegra(e.target.value)}
                    className="w-full bg-transparent text-base text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">
                  Quem paga a despesa gerada por essa regra?
                </label>
                <div className="flex flex-col gap-1.5">
                  {MODOS_RATEIO.map(({ modo, titulo, sub, Icone }) => {
                    const ativo = modoRateio === modo;
                    return (
                      <button
                        key={modo}
                        type="button"
                        onClick={() => (modo === 'personalizado' ? selecionarPersonalizado() : setModoRateio(modo))}
                        className={cn(
                          'flex items-start gap-2 rounded-xl border-[1.5px] px-3 py-2.5 text-left',
                          ativo ? 'border-hf-green-700 bg-hf-green-100' : 'border-hf-line bg-white'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]',
                            ativo ? 'bg-white' : 'bg-hf-cream-100'
                          )}
                        >
                          <Icone className={cn('h-3.5 w-3.5', ativo ? 'text-hf-green-700' : 'text-hf-stone-600')} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-[12.5px] font-bold text-hf-stone-900">{titulo}</p>
                          <p className={cn('m-0 mt-0.5 text-[10.5px] leading-tight', ativo ? 'text-hf-green-700' : 'text-hf-stone-400')}>
                            {sub}
                          </p>
                        </div>
                        <div
                          className={cn(
                            'mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                            ativo ? 'border-hf-green-800 bg-hf-green-800' : 'border-hf-line'
                          )}
                        >
                          {ativo && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {modoRateio === 'exclusivo' && (
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
                    value={rateioExclusivoId}
                    onChange={(e) => setRateioExclusivoId(e.target.value)}
                  >
                    {socios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                )}

                {modoRateio === 'personalizado' && (
                  <div className="mt-2 flex flex-col gap-2.5 rounded-xl border-[1.5px] border-hf-green-100 bg-[#fafcfa] p-3">
                    <div className="flex h-[11px] overflow-hidden rounded-full bg-hf-cream-100">
                      {socios.map((s, i) => (
                        <div
                          key={s.id}
                          className="h-full transition-all"
                          style={{
                            width: `${Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0}%`,
                            background: CORES_RATEIO[i % CORES_RATEIO.length].seg,
                          }}
                        />
                      ))}
                    </div>

                    <div
                      className={cn(
                        'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                        Math.abs(somaRateioPersonalizado - 100) <= 0.01 ? 'bg-hf-green-100 text-hf-green-700' : 'bg-hf-red-bg text-hf-red'
                      )}
                    >
                      {Math.abs(somaRateioPersonalizado - 100) <= 0.01 && <Check className="h-2.5 w-2.5" strokeWidth={2.6} />}
                      <span>Total: {somaRateioPersonalizado.toFixed(0)}%{Math.abs(somaRateioPersonalizado - 100) > 0.01 ? ' (precisa fechar em 100%)' : ''}</span>
                    </div>

                    <div className="flex flex-col">
                      {socios.map((s, i) => {
                        const cor = CORES_RATEIO[i % CORES_RATEIO.length];
                        const valor = Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0;
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-2 border-b border-hf-cream-100 py-2 last:border-b-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold"
                                style={{ background: cor.bg, color: cor.texto }}
                              >
                                {iniciais(s.nome)}
                              </span>
                              <span className="min-w-0 truncate text-[12px] font-bold text-hf-stone-900">{s.nome}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Diminuir percentual de ${s.nome}`}
                                onClick={() => ajustarPercentual(s.id, -5)}
                                className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-hf-line bg-white text-hf-green-800"
                              >
                                −
                              </button>
                              <span className="min-w-[30px] text-center text-[12.5px] font-extrabold tabular-nums text-hf-stone-900">
                                {valor}%
                              </span>
                              <button
                                type="button"
                                aria-label={`Aumentar percentual de ${s.nome}`}
                                onClick={() => ajustarPercentual(s.id, 5)}
                                className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-hf-line bg-white text-hf-green-800"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 pt-3">
              <button
                type="button"
                onClick={fecharFormulario}
                className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarRegra}
                disabled={
                  salvandoRegra ||
                  !valorRegraCentavos ||
                  !rateioValido ||
                  (tipoGatilho === 'POR_VENDA' && !unidadeRegra)
                }
                className="flex-1 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {salvandoRegra ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar regra'}
              </button>
            </div>
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}
