import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { meRequest } from '@/services/auth';
import { listarSociosRequest } from '@/services/sociedades';
import {
  atualizarAtivoRequest,
  criarRegraRequest,
  listarRegrasRequest,
} from '@/services/regrasDespesaRecorrente';
import { listarUnidadesRequest } from '@/services/unidadesVenda';
import { cn, formatarMoeda } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { Socio } from '@/types/sociedade';
import type { RegraDespesaRecorrente, TipoGatilhoRegra } from '@/types/regraDespesaRecorrente';
import type { TipoDespesa } from '@/types/despesa';
import type { UnidadeVenda } from '@/types/unidadeVenda';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

export default function ConfiguracoesRegrasDespesaPage() {
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

  const [socios, setSocios] = useState<Socio[]>([]);
  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);
  const [carregandoRegras, setCarregandoRegras] = useState(true);
  const [souFinanciador, setSouFinanciador] = useState(false);
  const [erroRegras, setErroRegras] = useState<string | null>(null);

  const [novaRegraAberta, setNovaRegraAberta] = useState(false);
  const [socioRegra, setSocioRegra] = useState('');
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoRegra>('POR_VENDA');
  const [tipoDespesaRegra, setTipoDespesaRegra] = useState<TipoDespesa>('OUTRO');
  const [valorRegra, setValorRegra] = useState('');
  const [unidadeRegra, setUnidadeRegra] = useState('');
  const [salvandoRegra, setSalvandoRegra] = useState(false);

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
      const comConta = res.socios.find((s) => s.usuario_id);
      if (comConta) setSocioRegra(comConta.usuario_id!);
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

  async function criarRegra() {
    if (!sociedadeId || !socioRegra || !valorRegra) return;
    if (tipoGatilho === 'POR_VENDA' && !unidadeRegra) return;
    setErroRegras(null);
    setSalvandoRegra(true);
    try {
      await criarRegraRequest(sociedadeId, {
        socio_id: socioRegra,
        tipo_gatilho: tipoGatilho,
        tipo_despesa: tipoDespesaRegra,
        valor: Number(valorRegra),
        unidade_id: tipoGatilho === 'POR_VENDA' ? unidadeRegra : undefined,
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
          onClick={voltar}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Regras de Despesa</h2>
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
                  {socios
                    .filter((s) => s.usuario_id)
                    .map((s) => (
                      <option key={s.id} value={s.usuario_id!}>
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
                  <option value="POR_VENDA">Por venda (valor por unidade)</option>
                  <option value="POR_PERIODO">Por período (valor fixo recorrente)</option>
                </select>
              </div>
              {tipoGatilho === 'POR_VENDA' && (
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Unidade</label>
                  <select
                    className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-sm"
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
                  {tipoGatilho === 'POR_VENDA' ? 'Valor por unidade (R$)' : 'Valor fixo (R$)'}
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
                  disabled={salvandoRegra || !socioRegra || !valorRegra || (tipoGatilho === 'POR_VENDA' && !unidadeRegra)}
                  className="flex-1 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {salvandoRegra ? 'Criando...' : 'Criar regra'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
