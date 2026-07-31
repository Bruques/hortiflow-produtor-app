import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { listarMinhasSafrasRequest } from '@/services/safras';
import { criarDespesaCompartilhadaRequest } from '@/services/despesas';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { cn } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { TipoDespesa } from '@/types/despesa';
import type { MinhaSafra } from '@/types/safra';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mesma máscara de dígitos-primeiro usada em NovaDespesaPage.
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

// Lançamento de uma despesa que se repete em várias safras ao mesmo tempo, rateada — pensado
// pro financiador com uma Sociedade por meeiro que tem um custo genuinamente compartilhado
// entre eles (ex: insumo usado na terra toda). Não é escopado a uma Safra/Sociedade
// específica (por isso fica fora do SafraLayout), já que o objetivo é justamente cruzar
// várias (docs/specs/11-resumo-consolidado-e-despesa-compartilhada.md).
export default function NovaDespesaCompartilhadaPage() {
  const navigate = useNavigate();

  const [safras, setSafras] = useState<MinhaSafra[]>([]);
  const [carregandoSafras, setCarregandoSafras] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [descricao, setDescricao] = useState('');
  const [valorCentavos, setValorCentavos] = useState('');
  const [data, setData] = useState(hojeISO());
  const [modoRateio, setModoRateio] = useState<'igual' | 'percentual'>('igual');
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarMinhasSafrasRequest()
      .then((res) => setSafras(res.safras.filter((s) => s.status === 'EM_ANDAMENTO')))
      .catch(() => setErro('Não foi possível carregar suas safras'))
      .finally(() => setCarregandoSafras(false));
  }, []);

  function alternarSafra(id: string) {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  }

  function alterarValor(texto: string) {
    setValorCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const idsSelecionados = useMemo(() => Array.from(selecionadas), [selecionadas]);
  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;

  const somaPercentuais = useMemo(
    () => idsSelecionados.reduce((acc, id) => acc + (Number(percentuais[id]?.replace(',', '.')) || 0), 0),
    [idsSelecionados, percentuais]
  );

  const rateioValido =
    modoRateio === 'igual' || (idsSelecionados.length > 0 && Math.abs(somaPercentuais - 100) <= 0.01);

  const formValido = idsSelecionados.length >= 2 && valorNumero > 0 && !!data && rateioValido;

  function mensagemErro(e: unknown, padrao: string): string {
    return (axios.isAxiosError(e) && e.response?.data?.error) || padrao;
  }

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarDespesaCompartilhadaRequest({
        safra_ids: idsSelecionados,
        tipo,
        valor_total: valorNumero,
        data,
        descricao: descricao.trim() || undefined,
        rateio:
          modoRateio === 'igual'
            ? { modo: 'igual' }
            : {
                modo: 'percentual',
                percentuais: idsSelecionados.map((id) => ({
                  safra_id: id,
                  percentual: Number(percentuais[id]?.replace(',', '.')) || 0,
                })),
              },
      });
      navigate('/');
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível lançar a despesa compartilhada'));
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate('/')}
            className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-hf-cream-100 px-3 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
            <span className="text-[15px] font-semibold">Voltar</span>
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">
            Despesa compartilhada
          </h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}
        <p className="text-[12.5px] text-hf-stone-600">
          Lance um custo que serve pra mais de uma safra/sociedade ao mesmo tempo (ex: um insumo
          usado na terra toda) — o valor é dividido e vira uma despesa normal em cada uma.
        </p>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">
            Quais safras participam?
          </label>
          {carregandoSafras && <p className="text-sm text-hf-stone-600">Carregando...</p>}
          {!carregandoSafras && safras.length < 2 && (
            <p className="text-sm text-hf-stone-600">
              Você precisa de pelo menos 2 safras ativas em sociedades diferentes pra usar isso.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {safras.map((s) => {
              const ativo = selecionadas.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => alternarSafra(s.id)}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border-[1.5px] px-3.5 py-3 text-left',
                    ativo ? 'border-hf-green-800 bg-hf-green-100' : 'border-hf-line bg-white'
                  )}
                >
                  <div>
                    <p className="m-0 text-sm font-bold text-hf-stone-900">{s.nome}</p>
                    <p className="m-0 text-xs text-hf-stone-600">{s.sociedade_nome}</p>
                  </div>
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      ativo ? 'border-hf-green-800 bg-hf-green-800' : 'border-hf-line'
                    )}
                  >
                    {ativo && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
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
            placeholder="Do que foi esse gasto?"
            maxLength={140}
            className="w-full rounded-2xl border-[1.5px] border-hf-line bg-white px-4 py-3 text-[13.5px] font-medium text-hf-stone-900 outline-none focus:border-hf-green-700"
          />
        </div>

        <div>
          <label className="mb-1 block text-center text-[12.5px] font-bold text-hf-green-700">
            Valor total
          </label>
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
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Data</label>
          <DatePickerField value={data} onChange={setData} />
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Como ratear?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModoRateio('igual')}
              className={cn(
                'flex-1 rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                modoRateio === 'igual' ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
              )}
            >
              Igualmente
            </button>
            <button
              type="button"
              onClick={() => setModoRateio('percentual')}
              className={cn(
                'flex-1 rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                modoRateio === 'percentual' ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
              )}
            >
              Percentual customizado
            </button>
          </div>

          {modoRateio === 'percentual' && idsSelecionados.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {idsSelecionados.map((id) => {
                const safra = safras.find((s) => s.id === id);
                return (
                  <div key={id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-hf-stone-700">
                      {safra?.nome} · {safra?.sociedade_nome}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={percentuais[id] ?? ''}
                        onChange={(e) =>
                          setPercentuais((atual) => ({ ...atual, [id]: e.target.value.replace(/[^\d,]/g, '') }))
                        }
                        className="w-16 rounded-lg border-[1.5px] border-hf-line bg-white px-2 py-1.5 text-right text-[13px] font-bold outline-none focus:border-hf-green-700"
                      />
                      <span className="text-[12.5px] text-hf-stone-600">%</span>
                    </div>
                  </div>
                );
              })}
              <p
                className={cn(
                  'text-right text-[11.5px] font-bold',
                  Math.abs(somaPercentuais - 100) <= 0.01 ? 'text-hf-green-700' : 'text-hf-red'
                )}
              >
                Soma: {somaPercentuais.toFixed(2)}% (precisa fechar em 100%)
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvar}
          disabled={!formValido || salvando}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Lançar despesa compartilhada'}
        </button>
      </div>
    </div>
  );
}
