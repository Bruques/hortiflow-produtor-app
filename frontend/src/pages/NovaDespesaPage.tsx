import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, ArrowLeft, Camera, Check, Percent, SlidersHorizontal, Trash2, User, X } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarDespesaRequest, atualizarDespesaRequest, excluirDespesaRequest, listarDespesasRequest } from '@/services/despesas';
import { listarSociosRequest } from '@/services/sociedades';
import { meRequest } from '@/services/auth';
import { DateSelectorChip } from '@/components/ui/date-selector-chip';
import { cn, iniciais } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { ItemRateio, TipoDespesa } from '@/types/despesa';
import type { Socio } from '@/types/sociedade';

type ModoRateio = 'padrao' | 'exclusivo' | 'personalizado';

// Deriva o modo de rateio a partir do que veio salvo (edição): null é padrão, uma linha só
// com 100% é "só um sócio", qualquer outra combinação é personalizado.
function modoRateioDe(rateio: ItemRateio[] | null): ModoRateio {
  if (!rateio || rateio.length === 0) return 'padrao';
  if (rateio.length === 1 && Math.abs(rateio[0].percentual - 100) <= 0.01) return 'exclusivo';
  return 'personalizado';
}

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

// Cores cíclicas pra segmento da barra de proporção + avatar de cada sócio no rateio
// personalizado — mesmo papel visual que a barra de percentual de lucro em Configurações.
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

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
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

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

export default function NovaDespesaPage() {
  const { safraId, sociedadeId } = useSafraAtiva();
  const navigate = useNavigate();
  const { despesaId } = useParams<{ despesaId: string }>();
  const emEdicao = !!despesaId;

  const [socios, setSocios] = useState<Socio[]>([]);
  const [todosSocios, setTodosSocios] = useState<Socio[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [socioId, setSocioId] = useState('');
  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [modoRateio, setModoRateio] = useState<ModoRateio>('padrao');
  const [rateioExclusivoId, setRateioExclusivoId] = useState('');
  const [rateioPercentuais, setRateioPercentuais] = useState<Record<string, string>>({});
  const [descricao, setDescricao] = useState('');
  const [valorCentavos, setValorCentavos] = useState(''); // só dígitos, sem formatação
  const [data, setData] = useState(hojeISO());
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoInputKey, setFotoInputKey] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [carregandoDespesa, setCarregandoDespesa] = useState(emEdicao);
  const [travadaPorAcerto, setTravadaPorAcerto] = useState(false);

  useEffect(() => {
    meRequest().then((res) => setMeuId(res.usuario.id)).catch(() => {});
    listarSociosRequest(sociedadeId)
      .then((res) => {
        // Despesa só pode ser lançada em nome de sócio com conta — sócio sem conta
        // ainda não tem um usuário pra receber a atribuição.
        const comConta = res.socios.filter((s) => s.usuario_id);
        setSocios(comConta);
        if (!emEdicao && comConta.length > 0) setSocioId(comConta[0].usuario_id!);
        // O rateio referencia o vínculo SocioSociedade (não o Usuario), então inclui todo
        // sócio da sociedade, mesmo sem conta ainda — ver docs/specs/13-rateio-de-despesas.md.
        setTodosSocios(res.socios);
        if (!emEdicao && res.socios.length > 0) setRateioExclusivoId(res.socios[0].id);
      })
      .catch(() => setErro('Não foi possível carregar os sócios'));
  }, [sociedadeId, emEdicao]);

  // Não existe endpoint de "buscar uma despesa" — a lista já é a fonte de verdade que a tela
  // de Despesas usa, então reaproveita ela e filtra pelo id da rota em vez de criar uma rota nova.
  useEffect(() => {
    if (!despesaId) return;
    // periodo 'safra' pra não cair no default 'dia' do backend — a despesa editada
    // pode ter sido lançada em qualquer data, não só hoje.
    listarDespesasRequest(safraId, { periodo: 'safra' })
      .then((res) => {
        const encontrada = res.despesas.find((d) => d.id === despesaId);
        if (!encontrada) {
          setErro('Despesa não encontrada');
          return;
        }
        setSocioId(encontrada.socio_id);
        setTipo(encontrada.tipo);
        setDescricao(encontrada.descricao ?? '');
        setValorCentavos(String(Math.round(Number(encontrada.valor) * 100)));
        setData(encontrada.data.slice(0, 10));
        setFoto(encontrada.foto_comprovante ?? null);
        setTravadaPorAcerto(encontrada.coberta_por_acerto);
        setModoRateio(modoRateioDe(encontrada.rateio));
        if (encontrada.rateio && encontrada.rateio.length === 1) {
          setRateioExclusivoId(encontrada.rateio[0].socio_id);
        } else if (encontrada.rateio) {
          setRateioPercentuais(
            Object.fromEntries(encontrada.rateio.map((r) => [r.socio_id, String(r.percentual)]))
          );
        }
      })
      .catch(() => setErro('Não foi possível carregar a despesa'))
      .finally(() => setCarregandoDespesa(false));
  }, [despesaId, safraId]);

  function alterarValor(texto: string) {
    setValorCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;

  const somaRateioPersonalizado = todosSocios.reduce(
    (acc, s) => acc + (Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0),
    0
  );
  const rateioValido =
    modoRateio === 'padrao' ||
    (modoRateio === 'exclusivo' && !!rateioExclusivoId) ||
    (modoRateio === 'personalizado' && Math.abs(somaRateioPersonalizado - 100) <= 0.01);

  const formValido = !!socioId && valorCentavos !== '' && valorNumero > 0 && !!data && rateioValido;

  // Ao entrar em "Personalizado" pela primeira vez (sem valores salvos), começa de um
  // split igualitário em vez de tudo zerado — reduz o trabalho de chegar em 100% no
  // caso mais comum (2-3 sócios dividindo igual algo que não é exatamente o lucro).
  function selecionarPersonalizado() {
    setModoRateio('personalizado');
    if (Object.keys(rateioPercentuais).length === 0 && todosSocios.length > 0) {
      const base = Math.floor(100 / todosSocios.length);
      const resto = 100 - base * todosSocios.length;
      setRateioPercentuais(
        Object.fromEntries(todosSocios.map((s, i) => [s.id, String(base + (i === 0 ? resto : 0))]))
      );
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
    return todosSocios
      .map((s) => ({ socio_id: s.id, percentual: Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
      .filter((r) => r.percentual > 0);
  }

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setFoto(await lerArquivoComoBase64(arquivo));
  }

  function mensagemErro(e: unknown, padrao: string): string {
    return (axios.isAxiosError(e) && e.response?.data?.error) || padrao;
  }

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      const rateio = rateioParaEnviar();
      if (emEdicao && despesaId) {
        await atualizarDespesaRequest(safraId, despesaId, {
          socio_id: socioId,
          tipo,
          valor: valorNumero,
          data,
          foto_comprovante: foto ?? undefined,
          descricao: descricao.trim() || undefined,
          rateio: rateio ?? null,
        });
      } else {
        await criarDespesaRequest(safraId, {
          socio_id: socioId,
          tipo,
          valor: valorNumero,
          data,
          foto_comprovante: foto ?? undefined,
          descricao: descricao.trim() || undefined,
          rateio,
        });
      }
      navigate(`/safras/${safraId}/despesas`);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível salvar a despesa'));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!despesaId) return;
    if (!window.confirm('Excluir essa despesa? Essa ação não pode ser desfeita.')) return;
    setErro(null);
    setExcluindo(true);
    try {
      await excluirDespesaRequest(safraId, despesaId);
      navigate(`/safras/${safraId}/despesas`);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível excluir a despesa'));
      setExcluindo(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            // Rota explícita em vez de navigate(-1): essa tela não tem bottom nav (ver
            // SafraLayout), então se o usuário chegar aqui sem histórico de navegação prévio
            // (link direto, refresh, PWA reaberto), voltar por histórico não tem pra onde ir e
            // trava a navegação.
            onClick={() => navigate(`/safras/${safraId}/despesas`)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">
            {emEdicao ? 'Editar despesa' : 'Nova despesa'}
          </h2>
          {emEdicao && (
            <button
              type="button"
              aria-label="Excluir despesa"
              title={travadaPorAcerto ? 'Essa despesa já foi acertada e não pode ser excluída' : undefined}
              onClick={excluir}
              disabled={excluindo || travadaPorAcerto}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-red disabled:opacity-50"
            >
              <Trash2 className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </button>
          )}
          {!emEdicao && <div className="h-[38px] w-[38px]" />}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        {travadaPorAcerto && (
          <div className="flex items-start gap-2.5 rounded-xl bg-hf-amber-bg px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-amber" strokeWidth={2} />
            <p className="m-0 text-[11.5px] text-hf-amber">
              Essa despesa já faz parte de um acerto registrado, então não pode mais ser editada ou excluída.
            </p>
          </div>
        )}

        {carregandoDespesa ? (
          <p className="text-center text-sm text-hf-stone-600">Carregando...</p>
        ) : (
          <>
        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Data</label>
          <DateSelectorChip value={data} onChange={setData} />
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Quem bancou?</label>
          <div className="flex gap-2 overflow-x-auto">
            {socios.map((s) => {
              const ativo = s.usuario_id === socioId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSocioId(s.usuario_id!)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold transition-colors',
                    ativo
                      ? 'border-hf-green-800 bg-hf-green-800 text-white'
                      : 'border-hf-line bg-white text-hf-stone-700'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-extrabold',
                      ativo ? 'bg-white/25 text-white' : 'bg-hf-green-100 text-hf-green-800'
                    )}
                  >
                    {iniciais(s.nome)}
                  </span>
                  {s.nome}
                  {s.usuario_id === meuId ? ' (Você)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Quem paga essa despesa?</label>
          <div className="flex flex-col gap-2">
            {MODOS_RATEIO.map(({ modo, titulo, sub, Icone }) => {
              const ativo = modoRateio === modo;
              return (
                <button
                  key={modo}
                  type="button"
                  onClick={() => (modo === 'personalizado' ? selecionarPersonalizado() : setModoRateio(modo))}
                  className={cn(
                    'flex items-start gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition-colors',
                    ativo ? 'border-hf-green-700 bg-hf-green-100' : 'border-hf-line bg-white'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]',
                      ativo ? 'bg-white' : 'bg-hf-cream-100'
                    )}
                  >
                    <Icone className={cn('h-4 w-4', ativo ? 'text-hf-green-700' : 'text-hf-stone-600')} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1 pt-px">
                    <p className="m-0 text-[13.5px] font-bold text-hf-stone-900">{titulo}</p>
                    <p className={cn('m-0 mt-0.5 text-[11.3px] leading-tight', ativo ? 'text-hf-green-700' : 'text-hf-stone-400')}>
                      {sub}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                      ativo ? 'border-hf-green-800 bg-hf-green-800' : 'border-hf-line'
                    )}
                  >
                    {ativo && <div className="h-[7px] w-[7px] rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {modoRateio === 'exclusivo' && (
            <div className="mt-2.5 rounded-2xl border-[1.5px] border-hf-green-100 bg-[#fafcfa] p-3">
              <p className="m-0 mb-2 text-[11px] font-bold text-hf-stone-600">Escolha quem paga:</p>
              <div className="flex gap-2 overflow-x-auto">
                {todosSocios.map((s) => {
                  const ativo = s.id === rateioExclusivoId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setRateioExclusivoId(s.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                        ativo ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-extrabold',
                          ativo ? 'bg-white/25 text-white' : 'bg-hf-green-100 text-hf-green-800'
                        )}
                      >
                        {iniciais(s.nome)}
                      </span>
                      {s.nome}
                      {s.usuario_id === meuId ? ' (Você)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {modoRateio === 'personalizado' && (
            <div className="mt-2.5 flex flex-col gap-3 rounded-2xl border-[1.5px] border-hf-green-100 bg-[#fafcfa] p-3.5">
              <div className="flex h-[13px] overflow-hidden rounded-full bg-hf-cream-100">
                {todosSocios.map((s, i) => (
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
                  'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold',
                  Math.abs(somaRateioPersonalizado - 100) <= 0.01 ? 'bg-hf-green-100 text-hf-green-700' : 'bg-hf-red-bg text-hf-red'
                )}
              >
                {Math.abs(somaRateioPersonalizado - 100) <= 0.01 && <Check className="h-3 w-3" strokeWidth={2.6} />}
                <span>Total: {somaRateioPersonalizado.toFixed(0)}%{Math.abs(somaRateioPersonalizado - 100) > 0.01 ? ' (precisa fechar em 100%)' : ''}</span>
              </div>

              <div className="flex flex-col">
                {todosSocios.map((s, i) => {
                  const cor = CORES_RATEIO[i % CORES_RATEIO.length];
                  const valor = Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 border-b border-hf-cream-100 py-2.5 last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                          style={{ background: cor.bg, color: cor.texto }}
                        >
                          {iniciais(s.nome)}
                        </span>
                        <span className="min-w-0 truncate text-[13px] font-bold text-hf-stone-900">
                          {s.nome}
                          {s.usuario_id === meuId ? ' (Você)' : ''}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Diminuir percentual de ${s.nome}`}
                          onClick={() => ajustarPercentual(s.id, -5)}
                          className="flex h-[25px] w-[25px] items-center justify-center rounded-full border-[1.5px] border-hf-line bg-white text-hf-green-800"
                        >
                          −
                        </button>
                        <span className="min-w-[34px] text-center text-[14px] font-extrabold tabular-nums text-hf-stone-900">
                          {valor}%
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar percentual de ${s.nome}`}
                          onClick={() => ajustarPercentual(s.id, 5)}
                          className="flex h-[25px] w-[25px] items-center justify-center rounded-full border-[1.5px] border-hf-line bg-white text-hf-green-800"
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

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Tipo de despesa</label>
          <div className="grid grid-cols-4 gap-2.5">
            {TIPOS_DESPESA.map((t) => {
              const Icone = ICONE_TIPO_DESPESA[t];
              const ativo = t === tipo;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] px-1 py-3',
                    ativo ? 'border-hf-green-700 bg-hf-green-100' : 'border-hf-line bg-white'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-[10px]',
                      ativo ? 'bg-white' : 'bg-hf-cream-100'
                    )}
                  >
                    <Icone
                      className={cn('h-[17px] w-[17px]', ativo ? 'text-hf-green-700' : 'text-hf-stone-600')}
                      strokeWidth={2}
                    />
                  </div>
                  <span className="text-center text-[10.2px] font-bold leading-tight text-hf-stone-700">
                    {ROTULO_TIPO_DESPESA[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Descrição (opcional)</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === 'OUTRO' ? 'Do que foi esse gasto?' : 'Detalhe algo sobre essa despesa'}
            maxLength={140}
            className="w-full rounded-2xl border-[1.5px] border-hf-line bg-white px-4 py-3 text-[13.5px] font-medium text-hf-stone-900 outline-none focus:border-hf-green-700"
          />
        </div>

        <div>
          <label className="mb-1 block text-center text-[12.5px] font-bold text-hf-green-700">Valor</label>
          <div className="flex items-baseline justify-center gap-1.5 border-b-2 border-hf-line pb-3 pt-3.5 focus-within:border-hf-green-700">
            <span className="text-[22px] font-bold text-hf-stone-400">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={formatarValorMascara(valorCentavos)}
              onChange={(e) => alterarValor(e.target.value)}
              className="w-[200px] bg-transparent text-left text-[40px] font-extrabold tabular-nums text-hf-stone-900 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Comprovante (opcional)</label>
          {!foto ? (
            <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-hf-line px-4 py-6 text-center text-hf-stone-600">
              <Camera className="h-[26px] w-[26px]" strokeWidth={1.8} />
              <span className="text-[13px] font-bold text-hf-stone-700">Tirar foto do comprovante</span>
              <span className="text-[11px] text-hf-stone-400">Toque para abrir a câmera</span>
              <input
                key={fotoInputKey}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={escolherFoto}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-hf-green-700 bg-hf-green-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <img src={foto} alt="Comprovante" className="h-[34px] w-[34px] rounded-lg object-cover" />
                <span className="text-[13px] font-bold text-hf-stone-900">Comprovante anexado</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFoto(null);
                  setFotoInputKey((k) => k + 1);
                }}
                aria-label="Remover comprovante"
                className="flex items-center gap-1 text-[11.5px] font-bold text-hf-red"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                Remover
              </button>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvar}
          disabled={!formValido || salvando || carregandoDespesa || travadaPorAcerto}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar despesa'}
        </button>
      </div>
    </div>
  );
}
