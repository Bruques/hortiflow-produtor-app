import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import {
  criarDespesaPessoalRequest,
  atualizarDespesaPessoalRequest,
  excluirDespesaPessoalRequest,
  listarDespesasPessoaisRequest,
} from '@/services/despesasPessoais';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { cn } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { TipoDespesa } from '@/types/despesa';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

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

// Mesma máscara estilo Pix usada em Nova despesa/venda — dígitos brutos em centavos,
// formatação derivada na hora de exibir.
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

export default function NovaDespesaPessoalPage() {
  const { safraId } = useSafraAtiva();
  const navigate = useNavigate();
  const { despesaPessoalId } = useParams<{ despesaPessoalId: string }>();
  const emEdicao = !!despesaPessoalId;

  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [descricao, setDescricao] = useState('');
  const [valorCentavos, setValorCentavos] = useState('');
  const [outraData, setOutraData] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [carregando, setCarregando] = useState(emEdicao);

  // Não existe endpoint de "buscar uma despesa pessoal" — reaproveita a listagem, igual
  // à mesma decisão já tomada em Nova despesa (sociedade).
  useEffect(() => {
    if (!despesaPessoalId) return;
    listarDespesasPessoaisRequest(safraId)
      .then((res) => {
        const encontrada = res.despesasPessoais.find((d) => d.id === despesaPessoalId);
        if (!encontrada) {
          setErro('Despesa não encontrada');
          return;
        }
        setTipo(encontrada.tipo);
        setDescricao(encontrada.descricao ?? '');
        setValorCentavos(String(Math.round(Number(encontrada.valor) * 100)));
        setData(encontrada.data.slice(0, 10));
        setOutraData(encontrada.data.slice(0, 10) !== hojeISO());
      })
      .catch(() => setErro('Não foi possível carregar a despesa'))
      .finally(() => setCarregando(false));
  }, [despesaPessoalId, safraId]);

  function selecionarOutraData() {
    setOutraData(true);
    setData('');
  }

  function selecionarHoje() {
    setOutraData(false);
    setData(hojeISO());
  }

  function alterarValor(texto: string) {
    setValorCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;
  const formValido = valorCentavos !== '' && valorNumero > 0 && !!data;

  function mensagemErro(e: unknown, padrao: string): string {
    return (axios.isAxiosError(e) && e.response?.data?.error) || padrao;
  }

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      const input = {
        tipo,
        valor: valorNumero,
        data,
        descricao: descricao.trim() || undefined,
      };
      if (emEdicao && despesaPessoalId) {
        await atualizarDespesaPessoalRequest(despesaPessoalId, input);
      } else {
        await criarDespesaPessoalRequest(safraId, input);
      }
      navigate(`/safras/${safraId}/despesas-pessoais`);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível salvar a despesa'));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!despesaPessoalId) return;
    if (!window.confirm('Excluir essa despesa pessoal? Essa ação não pode ser desfeita.')) return;
    setErro(null);
    setExcluindo(true);
    try {
      await excluirDespesaPessoalRequest(despesaPessoalId);
      navigate(`/safras/${safraId}/despesas-pessoais`);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível excluir a despesa'));
      setExcluindo(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(`/safras/${safraId}/despesas-pessoais`)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900 flex-1">
          {emEdicao ? 'Editar despesa pessoal' : 'Nova despesa pessoal'}
        </h2>
        {emEdicao && (
          <button
            type="button"
            aria-label="Excluir despesa"
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
        {carregando && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

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

        <div className="flex items-start gap-2.5 rounded-2xl bg-hf-green-100 px-4 py-3.5">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0 text-hf-green-700"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <p className="m-0 text-[12.5px] font-bold text-hf-stone-900">Visível só para você</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-hf-stone-600">
              Não entra na divisão de lucro nem no extrato da sociedade
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvar}
          disabled={!formValido || salvando || carregando}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar despesa'}
        </button>
      </div>
    </div>
  );
}
