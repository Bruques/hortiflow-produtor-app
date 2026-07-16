import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarDespesaRequest } from '@/services/despesas';
import { listarSociosRequest } from '@/services/sociedades';
import { meRequest } from '@/services/auth';
import { DateField } from '@/components/ui/date-field';
import { cn, iniciais } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import { ICONE_TIPO_DESPESA } from '@/lib/iconesTipoDespesa';
import type { TipoDespesa } from '@/types/despesa';
import type { Socio } from '@/types/sociedade';

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

  const [socios, setSocios] = useState<Socio[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [socioId, setSocioId] = useState('');
  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [valorTexto, setValorTexto] = useState('');
  const [outraData, setOutraData] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoInputKey, setFotoInputKey] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    meRequest().then((res) => setMeuId(res.usuario.id)).catch(() => {});
    listarSociosRequest(sociedadeId)
      .then((res) => {
        setSocios(res.socios);
        if (res.socios.length > 0) setSocioId(res.socios[0].usuario_id);
      })
      .catch(() => setErro('Não foi possível carregar os sócios'));
  }, [sociedadeId]);

  function selecionarOutraData() {
    setOutraData(true);
    setData('');
  }

  function selecionarHoje() {
    setOutraData(false);
    setData(hojeISO());
  }

  function alterarValor(texto: string) {
    const limpo = texto.replace(/[^\d,]/g, '');
    setValorTexto(limpo);
  }

  const valorNumero = Number(valorTexto.replace(',', '.'));
  const formValido = !!socioId && valorTexto !== '' && valorNumero > 0 && !!data;

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setFoto(await lerArquivoComoBase64(arquivo));
  }

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarDespesaRequest(safraId, {
        socio_id: socioId,
        tipo,
        valor: valorNumero,
        data,
        foto_comprovante: foto ?? undefined,
      });
      navigate(`/safras/${safraId}/despesas`);
    } catch {
      setErro('Não foi possível salvar a despesa');
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
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Nova despesa</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Quem bancou?</label>
          <div className="flex gap-2 overflow-x-auto">
            {socios.map((s) => {
              const ativo = s.usuario_id === socioId;
              return (
                <button
                  key={s.usuario_id}
                  type="button"
                  onClick={() => setSocioId(s.usuario_id)}
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
              inputMode="decimal"
              placeholder="0,00"
              value={valorTexto}
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
              <DateField value={data} onChange={setData} />
            </div>
          )}
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
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={salvar}
          disabled={!formValido || salvando}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar despesa'}
        </button>
      </div>
    </div>
  );
}
