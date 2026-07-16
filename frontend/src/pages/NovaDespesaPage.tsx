import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Camera, Trash2, X } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarDespesaRequest, atualizarDespesaRequest, excluirDespesaRequest, listarDespesasRequest } from '@/services/despesas';
import { listarSociosRequest } from '@/services/sociedades';
import { meRequest } from '@/services/auth';
import { DatePickerField } from '@/components/ui/date-picker-field';
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
  const [meuId, setMeuId] = useState<string | null>(null);
  const [socioId, setSocioId] = useState('');
  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [valorCentavos, setValorCentavos] = useState(''); // só dígitos, sem formatação
  const [outraData, setOutraData] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoInputKey, setFotoInputKey] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [carregandoDespesa, setCarregandoDespesa] = useState(emEdicao);

  useEffect(() => {
    meRequest().then((res) => setMeuId(res.usuario.id)).catch(() => {});
    listarSociosRequest(sociedadeId)
      .then((res) => {
        setSocios(res.socios);
        if (!emEdicao && res.socios.length > 0) setSocioId(res.socios[0].usuario_id);
      })
      .catch(() => setErro('Não foi possível carregar os sócios'));
  }, [sociedadeId, emEdicao]);

  // Não existe endpoint de "buscar uma despesa" — a lista já é a fonte de verdade que a tela
  // de Despesas usa, então reaproveita ela e filtra pelo id da rota em vez de criar uma rota nova.
  useEffect(() => {
    if (!despesaId) return;
    listarDespesasRequest(safraId)
      .then((res) => {
        const encontrada = res.despesas.find((d) => d.id === despesaId);
        if (!encontrada) {
          setErro('Despesa não encontrada');
          return;
        }
        setSocioId(encontrada.socio_id);
        setTipo(encontrada.tipo);
        setValorCentavos(String(Math.round(Number(encontrada.valor) * 100)));
        setData(encontrada.data.slice(0, 10));
        setOutraData(encontrada.data.slice(0, 10) !== hojeISO());
        setFoto(encontrada.foto_comprovante ?? null);
      })
      .catch(() => setErro('Não foi possível carregar a despesa'))
      .finally(() => setCarregandoDespesa(false));
  }, [despesaId, safraId]);

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
  const formValido = !!socioId && valorCentavos !== '' && valorNumero > 0 && !!data;

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
      const input = {
        socio_id: socioId,
        tipo,
        valor: valorNumero,
        data,
        foto_comprovante: foto ?? undefined,
      };
      if (emEdicao && despesaId) {
        await atualizarDespesaRequest(safraId, despesaId, input);
      } else {
        await criarDespesaRequest(safraId, input);
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
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
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
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900 flex-1">
          {emEdicao ? 'Editar despesa' : 'Nova despesa'}
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
        {carregandoDespesa && <p className="text-center text-sm text-hf-stone-600">Carregando...</p>}

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
          disabled={!formValido || salvando || carregandoDespesa}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar despesa'}
        </button>
      </div>
    </div>
  );
}
