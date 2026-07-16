import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Store, Info } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarVendaRequest } from '@/services/vendas';
import { listarRegrasRequest } from '@/services/regrasDespesaRecorrente';
import { DateField } from '@/components/ui/date-field';
import { cn, formatarMoeda } from '@/lib/utils';

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

export default function NovaVendaPage() {
  const { safraId, sociedadeId } = useSafraAtiva();
  const navigate = useNavigate();

  const [outraData, setOutraData] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [quantidade, setQuantidade] = useState(1);
  const [precoTexto, setPrecoTexto] = useState('');
  const [comprador, setComprador] = useState('');
  const [valorAutoPorCaixa, setValorAutoPorCaixa] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarRegrasRequest(sociedadeId)
      .then((res) => {
        const soma = res.regras
          .filter((r) => r.tipo_gatilho === 'POR_VENDA' && r.ativo)
          .reduce((acc, r) => acc + Number(r.valor), 0);
        setValorAutoPorCaixa(soma);
      })
      .catch(() => {});
  }, [sociedadeId]);

  function selecionarOutraData() {
    setOutraData(true);
    setData('');
  }

  function selecionarHoje() {
    setOutraData(false);
    setData(hojeISO());
  }

  function alterarPreco(texto: string) {
    setPrecoTexto(texto.replace(/[^\d,]/g, ''));
  }

  const precoNumero = Number(precoTexto.replace(',', '.')) || 0;
  const total = quantidade * precoNumero;
  const valorAuto = valorAutoPorCaixa * quantidade;
  const formValido = quantidade > 0 && precoNumero > 0 && !!data;

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarVendaRequest(safraId, {
        data,
        quantidade,
        preco: precoNumero,
        comprador: comprador || undefined,
      });
      navigate(`/safras/${safraId}/vendas`);
    } catch {
      setErro('Não foi possível salvar a venda');
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Nova venda</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

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
              <DateField value={data} onChange={setData} />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-center text-[12.5px] font-bold text-hf-green-700">
            Quantidade de caixas
          </label>
          <div className="flex items-center justify-center gap-6 py-1.5">
            <button
              type="button"
              aria-label="Diminuir"
              disabled={quantidade <= 1}
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800 disabled:opacity-35"
            >
              <Minus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
            <div className="min-w-[74px] text-center">
              <span className="block text-[32px] font-extrabold tabular-nums text-hf-stone-900">{quantidade}</span>
              <span className="text-[11px] text-hf-stone-400">caixas</span>
            </div>
            <button
              type="button"
              aria-label="Aumentar"
              onClick={() => setQuantidade((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Preço por caixa</label>
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
            <span className="text-[15px] font-bold text-hf-stone-600">R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={precoTexto}
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

        {valorAuto > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl bg-hf-green-100 px-3.5 py-3">
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-hf-green-600" strokeWidth={2} />
            <div>
              <p className="m-0 text-[12.5px] font-bold text-hf-stone-900">
                Vai gerar despesa automática de {formatarMoeda(valorAuto)}
              </p>
              <p className="m-0 mt-0.5 text-[11.5px] text-hf-stone-600">
                Regra recorrente ativa: {formatarMoeda(valorAutoPorCaixa)} por caixa vendida
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvar}
          disabled={!formValido || salvando}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar venda'}
        </button>
      </div>
    </div>
  );
}
