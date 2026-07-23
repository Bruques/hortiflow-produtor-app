import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Minus, Plus, Store, Info, Trash2 } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarVendaRequest, atualizarVendaRequest, excluirVendaRequest, listarVendasRequest } from '@/services/vendas';
import { listarRegrasRequest } from '@/services/regrasDespesaRecorrente';
import { listarUnidadesRequest } from '@/services/unidadesVenda';
import type { UnidadeVenda } from '@/types/unidadeVenda';
import type { RegraDespesaRecorrente } from '@/types/regraDespesaRecorrente';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { cn, formatarMoeda } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';

const MESES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function rotuloHoje(): string {
  const hoje = new Date();
  return `Hoje, ${hoje.getDate()} ${MESES_ABREV[hoje.getMonth()]}`;
}

// Máscara estilo apps de banco (Pix): usuário só digita números, e o valor se monta da direita
// pra esquerda (centavos primeiro) — "1" -> 0,01, "12345" -> 123,45. O estado guarda só os
// dígitos brutos (centavos); a formatação com pontos/vírgula é derivada na hora de exibir.
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

export default function NovaVendaPage() {
  const { safraId, sociedadeId } = useSafraAtiva();
  const navigate = useNavigate();
  const { vendaId } = useParams<{ vendaId: string }>();
  const emEdicao = !!vendaId;

  const [outraData, setOutraData] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [quantidadeTexto, setQuantidadeTexto] = useState('1');
  const [precoCentavos, setPrecoCentavos] = useState(''); // só dígitos, sem formatação
  const [comprador, setComprador] = useState('');
  const [pago, setPago] = useState(false);
  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [regrasPorVenda, setRegrasPorVenda] = useState<RegraDespesaRecorrente[]>([]);
  const [regrasMarcadas, setRegrasMarcadas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [carregandoVenda, setCarregandoVenda] = useState(emEdicao);

  // Guarda a última unidade pra qual os toggles foram calculados — evita resetar os toggles
  // toda vez que o efeito roda de novo (ex: regras terminando de carregar) sem o usuário ter
  // de fato trocado a unidade.
  const unidadeDosTogglesRef = useRef<string | null>(null);

  useEffect(() => {
    listarUnidadesRequest(sociedadeId)
      .then((res) => {
        setUnidades(res.unidades);
        const ativas = res.unidades.filter((u) => u.ativo);
        if (!emEdicao && ativas.length > 0) {
          setUnidadeId((atual) => atual || ativas[0].id);
        }
      })
      .catch(() => {});
    listarRegrasRequest(sociedadeId)
      .then((res) => {
        setRegrasPorVenda(res.regras.filter((r) => r.tipo_gatilho === 'POR_VENDA' && r.ativo));
      })
      .catch(() => {});
  }, [sociedadeId, emEdicao]);

  // Regra "por venda" só dispara despesa pra unidade a que foi amarrada (ex: R$1/caixa não se
  // aplica a uma venda em Kg) — só as regras da unidade escolhida viram toggle na tela.
  const regrasAplicaveis = regrasPorVenda.filter((r) => r.unidade_id === unidadeId);

  // Nova venda: toggles começam marcados (preserva a experiência de "já vem certo"). Edição:
  // o efeito de carregar a venda já define os toggles a partir do que foi confirmado antes, e
  // marca `unidadeDosTogglesRef` pra esse efeito não sobrescrever o estado carregado. Trocar de
  // unidade (em qualquer modo) reseta os toggles pra marcados, já que as regras mudam.
  useEffect(() => {
    if (carregandoVenda) return;
    if (unidadeDosTogglesRef.current === unidadeId) return;
    unidadeDosTogglesRef.current = unidadeId;
    setRegrasMarcadas(regrasAplicaveis.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeId, regrasPorVenda, carregandoVenda]);

  function alternarRegra(regraId: string) {
    setRegrasMarcadas((atual) => (atual.includes(regraId) ? atual.filter((id) => id !== regraId) : [...atual, regraId]));
  }

  // Mesma lógica da Nova despesa: sem endpoint de "buscar uma venda", reaproveita a lista que
  // a tela de Vendas já usa e filtra pelo id da rota.
  useEffect(() => {
    if (!vendaId) return;
    // periodo 'safra' pra não cair no default 'dia' do backend — a venda editada
    // pode ter sido lançada em qualquer data, não só hoje.
    listarVendasRequest(safraId, { periodo: 'safra' })
      .then((res) => {
        const encontrada = res.vendas.find((v) => v.id === vendaId);
        if (!encontrada) {
          setErro('Venda não encontrada');
          return;
        }
        setQuantidadeTexto(String(encontrada.quantidade));
        setPrecoCentavos(String(Math.round(Number(encontrada.preco) * 100)));
        setComprador(encontrada.comprador ?? '');
        setPago(encontrada.pago);
        setUnidadeId(encontrada.unidade_id);
        setData(encontrada.data.slice(0, 10));
        setOutraData(encontrada.data.slice(0, 10) !== hojeISO());
        unidadeDosTogglesRef.current = encontrada.unidade_id;
        setRegrasMarcadas(encontrada.regras_aplicadas);
      })
      .catch(() => setErro('Não foi possível carregar a venda'))
      .finally(() => setCarregandoVenda(false));
  }, [vendaId, safraId]);

  function selecionarOutraData() {
    setOutraData(true);
    setData('');
  }

  function selecionarHoje() {
    setOutraData(false);
    setData(hojeISO());
  }

  function alterarPreco(texto: string) {
    setPrecoCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  // Limita a 4 dígitos (até 9999 caixas) — evita o usuário colar um número absurdo por engano.
  function alterarQuantidade(texto: string) {
    setQuantidadeTexto(texto.replace(/\D/g, '').slice(0, 4));
  }

  const quantidade = Number(quantidadeTexto) || 0;
  const precoNumero = precoCentavos ? Number(precoCentavos) / 100 : 0;
  const total = quantidade * precoNumero;
  const unidadeSelecionada = unidades.find((u) => u.id === unidadeId);
  const formValido = quantidade > 0 && precoNumero > 0 && !!data && !!unidadeId;

  function mensagemErro(e: unknown, padrao: string): string {
    return (axios.isAxiosError(e) && e.response?.data?.error) || padrao;
  }

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      const input = {
        data,
        quantidade,
        preco: precoNumero,
        comprador: comprador || undefined,
        unidade_id: unidadeId,
        pago,
        regras_por_venda_aplicadas: regrasMarcadas,
      };
      if (emEdicao && vendaId) {
        await atualizarVendaRequest(safraId, vendaId, input);
      } else {
        await criarVendaRequest(safraId, input);
      }
      navigate(`/safras/${safraId}/vendas`);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível salvar a venda'));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!vendaId) return;
    if (!window.confirm('Excluir essa venda? Essa ação não pode ser desfeita.')) return;
    setErro(null);
    setExcluindo(true);
    try {
      await excluirVendaRequest(safraId, vendaId);
      navigate(`/safras/${safraId}/vendas`);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível excluir a venda'));
      setExcluindo(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          // Rota explícita em vez de navigate(-1) — mesma razão da Nova despesa: sem bottom
          // nav nesta tela, se não houver histórico prévio (link direto, refresh), voltar por
          // histórico trava a navegação.
          onClick={() => navigate(`/safras/${safraId}/vendas`)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900 flex-1">
          {emEdicao ? 'Editar venda' : 'Nova venda'}
        </h2>
        {emEdicao && (
          <button
            type="button"
            aria-label="Excluir venda"
            onClick={excluir}
            disabled={excluindo}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-red disabled:opacity-50"
          >
            <Trash2 className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}
        {carregandoVenda && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Data</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selecionarHoje}
              className={cn(
                'whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                !outraData ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
              )}
            >
              {rotuloHoje()}
            </button>
            <button
              type="button"
              onClick={selecionarOutraData}
              className={cn(
                'whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                outraData ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
              )}
            >
              Outra data
            </button>
          </div>
          {outraData && (
            <div className="mt-2.5">
              <DatePickerField value={data} onChange={setData} />
            </div>
          )}
        </div>

        {unidades.length > 1 && (
          <div>
            <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Unidade</label>
            <div className="flex flex-wrap gap-2">
              {unidades.filter((u) => u.ativo || u.id === unidadeId).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUnidadeId(u.id)}
                  className={cn(
                    'whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                    unidadeId === u.id
                      ? 'border-hf-green-800 bg-hf-green-800 text-white'
                      : 'border-hf-line bg-white text-hf-stone-700'
                  )}
                >
                  {u.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-center text-[12.5px] font-bold text-hf-green-700">
            Quantidade{unidadeSelecionada ? ` (${unidadeSelecionada.nome})` : ''}
          </label>
          <div className="flex items-center justify-center gap-6 py-1.5">
            <button
              type="button"
              aria-label="Diminuir"
              disabled={quantidade <= 1}
              onClick={() => setQuantidadeTexto(String(Math.max(1, quantidade - 1)))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800 disabled:opacity-35"
            >
              <Minus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
            <div className="min-w-[74px] text-center">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Quantidade"
                value={quantidadeTexto}
                onChange={(e) => alterarQuantidade(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-transparent text-center text-[32px] font-extrabold tabular-nums text-hf-stone-900 outline-none"
              />
              <span className="text-[11px] text-hf-stone-400">{unidadeSelecionada?.nome ?? 'unidades'}</span>
            </div>
            <button
              type="button"
              aria-label="Aumentar"
              onClick={() => setQuantidadeTexto(String(quantidade + 1))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">
            Preço por {unidadeSelecionada?.nome.toLowerCase() ?? 'unidade'}
          </label>
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
            <span className="text-[15px] font-bold text-hf-stone-600">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={formatarValorMascara(precoCentavos)}
              onChange={(e) => alterarPreco(e.target.value)}
              className="w-full bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-hf-cream-100 px-4 py-4 text-center">
          <p className="m-0 mb-1 text-xs text-hf-stone-600">Total da venda</p>
          <p className="m-0 text-[27px] font-extrabold tabular-nums text-hf-stone-900">{formatarMoeda(total)}</p>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Comprador</label>
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
            <Store className="h-[18px] w-[18px] shrink-0 text-hf-green-700" />
            <input
              type="text"
              placeholder="Ex: Ceasa Betim, Sacolão do Zé..."
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              className="w-full bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-hf-line px-4 py-3.5">
          <div>
            <p className="m-0 text-[13.5px] font-bold text-hf-stone-900">Já foi pago?</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-hf-stone-600">
              Se o comprador ainda não pagou, deixe desmarcado e edite depois
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pago}
            aria-label="Já foi pago?"
            onClick={() => setPago((v) => !v)}
            className={cn(
              'inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
              pago ? 'bg-hf-green-800' : 'bg-hf-cream-100'
            )}
          >
            <span
              className={cn(
                'h-5 w-5 rounded-full bg-white shadow transition-transform',
                pago ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {regrasAplicaveis.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-hf-green-600" strokeWidth={2} />
              <p className="m-0 text-[11.5px] text-hf-stone-600">
                Despesa recorrente aplicável a essa venda — desmarque se ela não deve ser lançada dessa vez
              </p>
            </div>
            {regrasAplicaveis.map((regra) => {
              const marcada = regrasMarcadas.includes(regra.id);
              const valorRegra = Number(regra.valor) * quantidade;
              return (
                <div
                  key={regra.id}
                  className="flex items-center justify-between rounded-2xl border-[1.5px] border-hf-line px-4 py-3.5"
                >
                  <div>
                    <p className="m-0 text-[13.5px] font-bold text-hf-stone-900">
                      {ROTULO_TIPO_DESPESA[regra.tipo_despesa]}: {formatarMoeda(valorRegra)}
                    </p>
                    <p className="m-0 mt-0.5 text-[11.5px] text-hf-stone-600">
                      {formatarMoeda(Number(regra.valor))} por {unidadeSelecionada?.nome.toLowerCase() ?? 'unidade'} vendida
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={marcada}
                    aria-label={`Aplicar despesa recorrente de ${ROTULO_TIPO_DESPESA[regra.tipo_despesa]}`}
                    onClick={() => alternarRegra(regra.id)}
                    className={cn(
                      'inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
                      marcada ? 'bg-hf-green-800' : 'bg-hf-cream-100'
                    )}
                  >
                    <span
                      className={cn(
                        'h-5 w-5 rounded-full bg-white shadow transition-transform',
                        marcada ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvar}
          disabled={!formValido || salvando || carregandoVenda}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar venda'}
        </button>
      </div>
    </div>
  );
}
