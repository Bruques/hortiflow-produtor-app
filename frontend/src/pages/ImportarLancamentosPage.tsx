import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Camera,
  FileSpreadsheet,
  Sparkles,
  AlertTriangle,
  Trash2,
  RotateCcw,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { extrairImportacaoRequest } from '@/services/importacao';
import { listarSociosRequest } from '@/services/sociedades';
import { listarUnidadesRequest, criarUnidadeRequest } from '@/services/unidadesVenda';
import { meRequest } from '@/services/auth';
import { criarDespesaRequest } from '@/services/despesas';
import { criarVendaRequest } from '@/services/vendas';
import { DateSelectorChip } from '@/components/ui/date-selector-chip';
import { cn, formatarMoeda } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import type { Socio } from '@/types/sociedade';
import type { UnidadeVenda } from '@/types/unidadeVenda';
import type { LinhaExtraida, TipoLancamentoSugerido } from '@/types/importacao';
import type { TipoDespesa } from '@/types/despesa';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

type ModoRateio = 'padrao' | 'exclusivo' | 'personalizado';

interface LinhaEditavel {
  id: string;
  origemArquivoIndex: number;
  confianca: 'ALTA' | 'BAIXA';
  tipo: TipoLancamentoSugerido;
  descartada: boolean;
  enviada: boolean;
  // despesa
  data: string;
  tipoDespesa: TipoDespesa;
  socioId: string;
  valorCentavos: string;
  descricao: string;
  anexarComprovante: boolean;
  imagemOrigem?: string;
  // Rateio: "quem bancou" (socioId, acima) é sobre quem tirou o dinheiro do bolso; rateio é
  // sobre quem esse valor é descontado na divisão de lucro — mesma distinção da tela manual
  // de despesa (NovaDespesaPage), reaproveitada aqui.
  modoRateio: ModoRateio;
  rateioExclusivoId: string;
  rateioPercentuais: Record<string, string>;
  // venda
  quantidadeTexto: string;
  precoCentavos: string;
  comprador: string;
  unidadeId: string;
  pago: boolean;
}

function paraLinhaEditavel(linha: LinhaExtraida, meuId: string | null, socios: Socio[], todosSocios: Socio[], unidades: UnidadeVenda[]): LinhaEditavel {
  const nomeSugerido = linha.unidade_nome_sugerido?.trim().toLowerCase();
  const unidadeCorrespondente = nomeSugerido ? unidades.find((u) => u.nome.trim().toLowerCase() === nomeSugerido) : undefined;
  const socioPadrao = socios.find((s) => s.usuario_id === meuId) ?? socios[0];

  return {
    id: `${linha.origem_arquivo_index}-${Math.random().toString(36).slice(2, 9)}`,
    origemArquivoIndex: linha.origem_arquivo_index,
    confianca: linha.confianca,
    tipo: linha.tipo_sugerido,
    descartada: false,
    enviada: false,
    data: linha.data ?? '',
    tipoDespesa: linha.tipo_despesa ?? 'OUTRO',
    socioId: socioPadrao?.usuario_id ?? '',
    valorCentavos: linha.valor ? String(Math.round(linha.valor * 100)) : '',
    descricao: linha.descricao ?? '',
    anexarComprovante: !!linha.imagem_origem_base64,
    imagemOrigem: linha.imagem_origem_base64,
    modoRateio: 'padrao',
    rateioExclusivoId: todosSocios[0]?.id ?? '',
    rateioPercentuais: {},
    quantidadeTexto: linha.quantidade ? String(linha.quantidade) : '',
    precoCentavos: linha.preco ? String(Math.round(linha.preco * 100)) : '',
    comprador: linha.comprador ?? '',
    unidadeId: unidadeCorrespondente?.id ?? '',
    pago: false,
  };
}

// Divide 100% em `n` fatias, todas múltiplas de 5, o mais igual possível — ponto de partida do
// rateio personalizado (mesma lógica de NovaDespesaPage.tsx, copiada porque essa tela não
// importa componentes daquela para não acoplar os dois fluxos de criação de despesa).
function splitPercentuaisMultiplosDe5(n: number): number[] {
  const totalFatias = 20;
  const base = Math.floor(totalFatias / n);
  const resto = totalFatias - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) * 5);
}

function rateioValido(l: LinhaEditavel, todosSocios: Socio[]): boolean {
  if (l.modoRateio === 'padrao') return true;
  if (l.modoRateio === 'exclusivo') return !!l.rateioExclusivoId;
  const soma = todosSocios.reduce((acc, s) => acc + (Number(l.rateioPercentuais[s.id]?.replace(',', '.')) || 0), 0);
  return Math.abs(soma - 100) <= 0.01;
}

function linhaValida(l: LinhaEditavel, todosSocios: Socio[]): boolean {
  if (l.tipo === 'DESPESA') {
    return !!l.data && !!l.socioId && Number(l.valorCentavos) > 0 && rateioValido(l, todosSocios);
  }
  return !!l.data && Number(l.quantidadeTexto) > 0 && Number(l.precoCentavos) > 0 && !!l.unidadeId;
}

function rateioParaEnviar(l: LinhaEditavel, todosSocios: Socio[]): { socio_id: string; percentual: number }[] | undefined {
  if (l.modoRateio === 'padrao') return undefined;
  if (l.modoRateio === 'exclusivo') return l.rateioExclusivoId ? [{ socio_id: l.rateioExclusivoId, percentual: 100 }] : undefined;
  return todosSocios
    .map((s) => ({ socio_id: s.id, percentual: Number(l.rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
    .filter((r) => r.percentual > 0);
}

function mensagemErro(e: unknown, padrao: string): string {
  return (axios.isAxiosError(e) && e.response?.data?.error) || padrao;
}

type Etapa = 'upload' | 'revisao' | 'resumo';

export default function ImportarLancamentosPage() {
  const { safraId, sociedadeId } = useSafraAtiva();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [socios, setSocios] = useState<Socio[]>([]);
  const [todosSocios, setTodosSocios] = useState<Socio[]>([]);
  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);

  const [modoArquivo, setModoArquivo] = useState<'fotos' | 'planilha' | null>(null);
  const [fotosOuPdf, setFotosOuPdf] = useState<File[]>([]);
  const [planilha, setPlanilha] = useState<File | null>(null);
  const [nomesArquivos, setNomesArquivos] = useState<string[]>([]);

  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaEditavel[]>([]);
  const [arquivosSemLeitura, setArquivosSemLeitura] = useState<number[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  const [nomeNovaUnidade, setNomeNovaUnidade] = useState<Record<string, string>>({});
  const [criandoUnidade, setCriandoUnidade] = useState<string | null>(null);

  useEffect(() => {
    meRequest().then((res) => setMeuId(res.usuario.id)).catch(() => {});
    listarSociosRequest(sociedadeId)
      .then((res) => {
        // "Quem bancou" (socioId) só pode ser um sócio com conta vinculada, já que Despesa
        // referencia Usuario — mesma regra de NovaDespesaPage. Rateio referencia SocioSociedade
        // (não Usuario), então inclui todo sócio, com ou sem conta (ex: meeiro sem login ainda).
        setSocios(res.socios.filter((s) => s.usuario_id));
        setTodosSocios(res.socios);
      })
      .catch(() => {});
    listarUnidadesRequest(sociedadeId)
      .then((res) => setUnidades(res.unidades))
      .catch(() => {});
  }, [sociedadeId]);

  function escolherFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (arquivos.length === 0) return;
    setModoArquivo('fotos');
    setPlanilha(null);
    setFotosOuPdf((atual) => [...atual, ...arquivos]);
    e.target.value = '';
  }

  function escolherPlanilha(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setModoArquivo('planilha');
    setFotosOuPdf([]);
    setPlanilha(arquivo);
    e.target.value = '';
  }

  function removerFoto(index: number) {
    setFotosOuPdf((atual) => atual.filter((_, i) => i !== index));
  }

  const arquivosSelecionados = modoArquivo === 'planilha' ? (planilha ? [planilha] : []) : fotosOuPdf;

  async function analisar() {
    if (arquivosSelecionados.length === 0) return;
    setErro(null);
    setAnalisando(true);
    try {
      const arquivos = await Promise.all(
        arquivosSelecionados.map(async (arquivo) => ({ nome: arquivo.name, base64: await lerArquivoComoBase64(arquivo) }))
      );
      setNomesArquivos(arquivos.map((a) => a.nome));
      const resultado = await extrairImportacaoRequest(safraId, arquivos);
      setLinhas(resultado.linhas.map((l) => paraLinhaEditavel(l, meuId, socios, todosSocios, unidades)));
      setArquivosSemLeitura(resultado.arquivos_sem_leitura);
      setEtapa('revisao');
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível analisar os arquivos agora. Tente novamente em instantes.'));
    } finally {
      setAnalisando(false);
    }
  }

  function atualizarLinha(id: string, patch: Partial<LinhaEditavel>) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function alternarDescarte(id: string) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, descartada: !l.descartada } : l)));
  }

  async function criarUnidadeParaLinha(linha: LinhaEditavel) {
    const nomeFinal = nomeNovaUnidade[linha.id]?.trim();
    if (!nomeFinal) return;
    setCriandoUnidade(linha.id);
    try {
      const { unidade } = await criarUnidadeRequest(sociedadeId, nomeFinal);
      setUnidades((atual) => [...atual, unidade]);
      atualizarLinha(linha.id, { unidadeId: unidade.id });
      setNomeNovaUnidade((atual) => ({ ...atual, [linha.id]: '' }));
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível criar a unidade de venda'));
    } finally {
      setCriandoUnidade(null);
    }
  }

  const linhasAtivas = linhas.filter((l) => !l.descartada);
  const contagemProntas = linhasAtivas.filter((l) => !l.enviada && linhaValida(l, todosSocios)).length;
  const contagemRevisar = linhasAtivas.filter((l) => !l.enviada && !linhaValida(l, todosSocios)).length;
  const contagemDescartadas = linhas.length - linhasAtivas.length;

  async function confirmarImportacao() {
    setErro(null);
    setConfirmando(true);
    const pendentes = linhas.filter((l) => !l.descartada && !l.enviada && linhaValida(l, todosSocios));
    try {
      for (const linha of pendentes) {
        if (linha.tipo === 'DESPESA') {
          await criarDespesaRequest(safraId, {
            socio_id: linha.socioId,
            tipo: linha.tipoDespesa,
            valor: Number(linha.valorCentavos) / 100,
            data: linha.data,
            foto_comprovante: linha.anexarComprovante ? linha.imagemOrigem : undefined,
            descricao: linha.descricao.trim() || undefined,
            rateio: rateioParaEnviar(linha, todosSocios),
          });
        } else {
          await criarVendaRequest(safraId, {
            data: linha.data,
            quantidade: Number(linha.quantidadeTexto),
            preco: Number(linha.precoCentavos) / 100,
            comprador: linha.comprador.trim() || undefined,
            unidade_id: linha.unidadeId,
            pago: linha.pago,
          });
        }
        setLinhas((atual) => atual.map((x) => (x.id === linha.id ? { ...x, enviada: true } : x)));
      }
      setEtapa('resumo');
    } catch (e) {
      setErro(
        mensagemErro(
          e,
          'Não foi possível importar um dos lançamentos. Os que já foram importados estão salvos — toque em "Importar" de novo pra tentar os que faltam.'
        )
      );
    } finally {
      setConfirmando(false);
    }
  }

  const totalEnviadasDespesa = linhas.filter((l) => l.enviada && l.tipo === 'DESPESA').length;
  const totalEnviadasVenda = linhas.filter((l) => l.enviada && l.tipo === 'VENDA').length;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate(`/safras/${safraId}/menu`)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">
            Importar lançamentos
          </h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        {etapa === 'upload' && (
          <>
            <p className="m-0 text-[13px] leading-snug text-hf-stone-600">
              Envie foto(s) de página de caderno, print, PDF ou uma planilha com despesas e vendas dessa safra — a
              IA vai sugerir os lançamentos, e você revisa e confirma cada um antes de salvar.
            </p>

            <div>
              <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Foto, print ou PDF</label>
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-hf-line px-4 py-6 text-center text-hf-stone-600">
                <Camera className="h-[26px] w-[26px]" strokeWidth={1.8} />
                <span className="text-[13px] font-bold text-hf-stone-700">Adicionar foto(s) ou PDF</span>
                <span className="text-[11px] text-hf-stone-400">Pode selecionar várias páginas de uma vez</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={escolherFotos} className="hidden" />
              </label>
              {modoArquivo === 'fotos' && fotosOuPdf.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {fotosOuPdf.map((arquivo, i) => (
                    <div key={`${arquivo.name}-${i}`} className="flex items-center justify-between rounded-xl bg-hf-cream-100 px-3 py-2">
                      <span className="min-w-0 truncate text-[12px] font-medium text-hf-stone-700">{arquivo.name}</span>
                      <button type="button" aria-label="Remover arquivo" onClick={() => removerFoto(i)} className="shrink-0 text-hf-red">
                        <X className="h-[14px] w-[14px]" strokeWidth={2.4} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="h-px flex-1 bg-hf-line" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-hf-stone-400">ou</span>
              <div className="h-px flex-1 bg-hf-line" />
            </div>

            <div>
              <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Planilha</label>
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-hf-line px-4 py-6 text-center text-hf-stone-600">
                <FileSpreadsheet className="h-[26px] w-[26px]" strokeWidth={1.8} />
                <span className="text-[13px] font-bold text-hf-stone-700">Adicionar planilha</span>
                <span className="text-[11px] text-hf-stone-400">.xlsx, .xls ou .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={escolherPlanilha} className="hidden" />
              </label>
              {modoArquivo === 'planilha' && planilha && (
                <div className="mt-2.5 flex items-center justify-between rounded-xl bg-hf-cream-100 px-3 py-2">
                  <span className="min-w-0 truncate text-[12px] font-medium text-hf-stone-700">{planilha.name}</span>
                  <button type="button" aria-label="Remover planilha" onClick={() => setPlanilha(null)} className="shrink-0 text-hf-red">
                    <X className="h-[14px] w-[14px]" strokeWidth={2.4} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {etapa === 'revisao' && (
          <>
            {arquivosSemLeitura.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl bg-hf-amber-bg px-3.5 py-3">
                <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-amber" strokeWidth={2} />
                <p className="m-0 text-[11.5px] text-hf-amber">
                  Não conseguimos identificar nenhum lançamento em: {arquivosSemLeitura.map((i) => nomesArquivos[i]).join(', ')}.
                  Considere tirar a foto de novo se esperava encontrar algo ali.
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-hf-cream-100 px-4 py-3 text-[12px] font-bold text-hf-stone-700">
              {contagemProntas} pronta{contagemProntas === 1 ? '' : 's'} · {contagemRevisar} precisa
              {contagemRevisar === 1 ? '' : 'm'} de revisão · {contagemDescartadas} descartada
              {contagemDescartadas === 1 ? '' : 's'}
            </div>

            {linhas.length === 0 && (
              <p className="text-center text-sm text-hf-stone-600">Nenhum lançamento identificado nos arquivos enviados.</p>
            )}

            {linhas.map((linha) => {
              const valida = linhaValida(linha, todosSocios);
              return (
                <div
                  key={linha.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-2xl border-[1.5px] p-3.5',
                    linha.descartada ? 'border-hf-line bg-hf-cream-100 opacity-60' : valida ? 'border-hf-line bg-white' : 'border-hf-amber-bg bg-[#fffaf1]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          linha.confianca === 'ALTA' ? 'bg-hf-green-100 text-hf-green-800' : 'bg-hf-amber-bg text-hf-amber'
                        )}
                      >
                        Confiança {linha.confianca === 'ALTA' ? 'alta' : 'baixa'}
                      </span>
                      {linha.enviada && (
                        <span className="flex items-center gap-1 rounded-full bg-hf-green-100 px-2 py-0.5 text-[10px] font-bold text-hf-green-800">
                          <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.6} />
                          Importado
                        </span>
                      )}
                    </div>
                    {!linha.enviada && (
                      <button
                        type="button"
                        onClick={() => alternarDescarte(linha.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-hf-stone-400"
                      >
                        {linha.descartada ? (
                          <>
                            <RotateCcw className="h-3 w-3" strokeWidth={2.4} /> Restaurar
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3" strokeWidth={2.4} /> Descartar
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {!linha.descartada && (
                    <>
                      <div className="flex gap-2">
                        {(['DESPESA', 'VENDA'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            disabled={linha.enviada}
                            onClick={() => atualizarLinha(linha.id, { tipo: t })}
                            className={cn(
                              'flex-1 rounded-xl border-[1.5px] py-2 text-center text-[12px] font-bold disabled:opacity-50',
                              linha.tipo === t ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
                            )}
                          >
                            {t === 'DESPESA' ? 'Despesa' : 'Venda'}
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Data</label>
                        <DateSelectorChip
                          value={linha.data || new Date().toISOString().slice(0, 10)}
                          onChange={(v) => atualizarLinha(linha.id, { data: v })}
                        />
                        {!linha.data && <p className="m-0 mt-1 text-[10.5px] text-hf-red">Preencha a data</p>}
                      </div>

                      {linha.tipo === 'DESPESA' ? (
                        <>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Categoria</label>
                            <select
                              value={linha.tipoDespesa}
                              disabled={linha.enviada}
                              onChange={(e) => atualizarLinha(linha.id, { tipoDespesa: e.target.value as TipoDespesa })}
                              className="w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900"
                            >
                              {TIPOS_DESPESA.map((t) => (
                                <option key={t} value={t}>
                                  {ROTULO_TIPO_DESPESA[t]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Quem bancou?</label>
                            <select
                              value={linha.socioId}
                              disabled={linha.enviada}
                              onChange={(e) => atualizarLinha(linha.id, { socioId: e.target.value })}
                              className="w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900"
                            >
                              <option value="">Selecione...</option>
                              {socios.map((s) => (
                                <option key={s.id} value={s.usuario_id!}>
                                  {s.nome}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Quem paga essa despesa?</label>
                            <div className="flex gap-1.5">
                              {(
                                [
                                  { modo: 'padrao' as const, titulo: 'Como o lucro' },
                                  { modo: 'exclusivo' as const, titulo: 'Só um sócio' },
                                  { modo: 'personalizado' as const, titulo: 'Personalizado' },
                                ]
                              ).map(({ modo, titulo }) => (
                                <button
                                  key={modo}
                                  type="button"
                                  disabled={linha.enviada}
                                  onClick={() =>
                                    atualizarLinha(linha.id, {
                                      modoRateio: modo,
                                      rateioPercentuais:
                                        modo === 'personalizado' && Object.keys(linha.rateioPercentuais).length === 0
                                          ? Object.fromEntries(
                                              todosSocios.map((s, i) => [s.id, String(splitPercentuaisMultiplosDe5(todosSocios.length)[i])])
                                            )
                                          : linha.rateioPercentuais,
                                    })
                                  }
                                  className={cn(
                                    'flex-1 rounded-xl border-[1.5px] py-2 text-center text-[11px] font-bold disabled:opacity-50',
                                    linha.modoRateio === modo
                                      ? 'border-hf-green-700 bg-hf-green-100 text-hf-green-800'
                                      : 'border-hf-line bg-white text-hf-stone-700'
                                  )}
                                >
                                  {titulo}
                                </button>
                              ))}
                            </div>

                            {linha.modoRateio === 'exclusivo' && (
                              <select
                                value={linha.rateioExclusivoId}
                                disabled={linha.enviada}
                                onChange={(e) => atualizarLinha(linha.id, { rateioExclusivoId: e.target.value })}
                                className="mt-2 w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900"
                              >
                                {todosSocios.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.nome}
                                  </option>
                                ))}
                              </select>
                            )}

                            {linha.modoRateio === 'personalizado' && (
                              <div className="mt-2 flex flex-col gap-1.5 rounded-xl border-[1.5px] border-hf-green-100 bg-[#fafcfa] p-2.5">
                                {todosSocios.map((s) => (
                                  <div key={s.id} className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-[12px] font-medium text-hf-stone-700">{s.nome}</span>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        disabled={linha.enviada}
                                        value={linha.rateioPercentuais[s.id] ?? ''}
                                        onChange={(e) =>
                                          atualizarLinha(linha.id, {
                                            rateioPercentuais: { ...linha.rateioPercentuais, [s.id]: e.target.value.replace(/\D/g, '').slice(0, 3) },
                                          })
                                        }
                                        className="w-12 rounded-lg border-[1.5px] border-hf-line px-1.5 py-1 text-center text-[12px] font-bold text-hf-stone-900 outline-none"
                                      />
                                      <span className="text-[12px] font-bold text-hf-stone-500">%</span>
                                    </div>
                                  </div>
                                ))}
                                {!rateioValido(linha, todosSocios) && (
                                  <p className="m-0 text-[10.5px] text-hf-red">A soma precisa fechar em 100%</p>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Valor</label>
                            <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-hf-line px-3 py-2.5">
                              <span className="text-[13px] font-bold text-hf-stone-500">R$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={linha.enviada}
                                value={formatarValorMascara(linha.valorCentavos)}
                                onChange={(e) => atualizarLinha(linha.id, { valorCentavos: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                placeholder="0,00"
                                className="w-full bg-transparent text-[13px] font-bold text-hf-stone-900 outline-none"
                              />
                            </div>
                          </div>

                          <input
                            type="text"
                            value={linha.descricao}
                            disabled={linha.enviada}
                            onChange={(e) => atualizarLinha(linha.id, { descricao: e.target.value })}
                            placeholder="Descrição (opcional)"
                            className="w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900 outline-none"
                          />

                          {linha.imagemOrigem && (
                            <label className="flex items-center gap-2 text-[11.5px] font-medium text-hf-stone-700">
                              <input
                                type="checkbox"
                                checked={linha.anexarComprovante}
                                disabled={linha.enviada}
                                onChange={(e) => atualizarLinha(linha.id, { anexarComprovante: e.target.checked })}
                              />
                              Anexar essa imagem como comprovante
                            </label>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex gap-2.5">
                            <div className="flex-1">
                              <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Quantidade</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={linha.enviada}
                                value={linha.quantidadeTexto}
                                onChange={(e) => atualizarLinha(linha.id, { quantidadeTexto: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                className="w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900 outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Preço unitário</label>
                              <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-hf-line px-3 py-2.5">
                                <span className="text-[13px] font-bold text-hf-stone-500">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={linha.enviada}
                                  value={formatarValorMascara(linha.precoCentavos)}
                                  onChange={(e) => atualizarLinha(linha.id, { precoCentavos: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                  placeholder="0,00"
                                  className="w-full bg-transparent text-[13px] font-bold text-hf-stone-900 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {Number(linha.quantidadeTexto) > 0 && Number(linha.precoCentavos) > 0 && (
                            <p className="m-0 text-[11.5px] text-hf-stone-600">
                              Total: <strong>{formatarMoeda((Number(linha.quantidadeTexto) * Number(linha.precoCentavos)) / 100)}</strong>
                            </p>
                          )}

                          <div>
                            <label className="mb-1.5 block text-[11px] font-bold text-hf-green-700">Unidade</label>
                            <select
                              value={linha.unidadeId}
                              disabled={linha.enviada}
                              onChange={(e) => atualizarLinha(linha.id, { unidadeId: e.target.value })}
                              className="w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900"
                            >
                              <option value="">Selecione...</option>
                              {unidades.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nome}
                                </option>
                              ))}
                            </select>
                            {!linha.unidadeId && !linha.enviada && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="text"
                                  value={nomeNovaUnidade[linha.id] ?? ''}
                                  onChange={(e) => setNomeNovaUnidade((atual) => ({ ...atual, [linha.id]: e.target.value }))}
                                  placeholder={linha.unidadeId ? '' : 'ou crie uma nova, ex: Caixa'}
                                  className="flex-1 rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2 text-[12.5px] font-medium text-hf-stone-900 outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={!nomeNovaUnidade[linha.id]?.trim() || criandoUnidade === linha.id}
                                  onClick={() => criarUnidadeParaLinha(linha)}
                                  className="shrink-0 rounded-xl bg-hf-green-800 px-3 text-[12px] font-bold text-white disabled:opacity-50"
                                >
                                  Criar
                                </button>
                              </div>
                            )}
                          </div>

                          <input
                            type="text"
                            value={linha.comprador}
                            disabled={linha.enviada}
                            onChange={(e) => atualizarLinha(linha.id, { comprador: e.target.value })}
                            placeholder="Comprador (opcional)"
                            className="w-full rounded-xl border-[1.5px] border-hf-line bg-white px-3 py-2.5 text-[13px] font-medium text-hf-stone-900 outline-none"
                          />

                          <label className="flex items-center gap-2 text-[11.5px] font-medium text-hf-stone-700">
                            <input
                              type="checkbox"
                              checked={linha.pago}
                              disabled={linha.enviada}
                              onChange={(e) => atualizarLinha(linha.id, { pago: e.target.checked })}
                            />
                            Já foi pago
                          </label>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}

        {etapa === 'resumo' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-hf-green-700" strokeWidth={1.6} />
            <p className="m-0 text-[15px] font-extrabold text-hf-stone-900">Importação concluída</p>
            <p className="m-0 text-[13px] text-hf-stone-600">
              {totalEnviadasDespesa} despesa{totalEnviadasDespesa === 1 ? '' : 's'} e {totalEnviadasVenda} venda
              {totalEnviadasVenda === 1 ? '' : 's'} importadas
            </p>
            <div className="mt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => navigate(`/safras/${safraId}/despesas`)}
                className="rounded-xl border-[1.5px] border-hf-line px-4 py-2.5 text-[12.5px] font-bold text-hf-stone-700"
              >
                Ver despesas
              </button>
              <button
                type="button"
                onClick={() => navigate(`/safras/${safraId}/vendas`)}
                className="rounded-xl border-[1.5px] border-hf-line px-4 py-2.5 text-[12.5px] font-bold text-hf-stone-700"
              >
                Ver vendas
              </button>
            </div>
          </div>
        )}
      </div>

      {etapa !== 'resumo' && (
        <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
          <button
            type="button"
            onClick={etapa === 'upload' ? analisar : confirmarImportacao}
            disabled={
              etapa === 'upload' ? arquivosSelecionados.length === 0 || analisando : contagemProntas === 0 || confirmando
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
          >
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
            {etapa === 'upload'
              ? analisando
                ? 'Analisando com IA...'
                : 'Analisar com IA'
              : confirmando
                ? 'Importando...'
                : `Importar ${contagemProntas} lançamento${contagemProntas === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
}
