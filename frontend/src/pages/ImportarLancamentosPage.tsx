import { useEffect, useRef, useState } from 'react';
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
  Plus,
  Info,
  PenLine,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ListChecks,
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
  // true = criada pelo botão "Adicionar lançamento" (sócio percebeu que a IA deixou passar
  // algo), não veio de extração nenhuma — troca o selo de confiança por um selo próprio.
  manual: boolean;
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
    manual: false,
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

// Linha em branco criada pelo botão "Adicionar lançamento" — cobre o caso (esperado, não um bug
// a perseguir) de a IA deixar passar algo que estava na foto/planilha; o sócio completa na mão
// em vez de precisar sair do fluxo de importação pra lançar manualmente noutra tela.
function novaLinhaManual(meuId: string | null, socios: Socio[], todosSocios: Socio[]): LinhaEditavel {
  const socioPadrao = socios.find((s) => s.usuario_id === meuId) ?? socios[0];
  return {
    id: `manual-${Math.random().toString(36).slice(2, 9)}`,
    origemArquivoIndex: -1,
    confianca: 'ALTA',
    manual: true,
    tipo: 'DESPESA',
    descartada: false,
    enviada: false,
    data: '',
    tipoDespesa: 'OUTRO',
    socioId: socioPadrao?.usuario_id ?? '',
    valorCentavos: '',
    descricao: '',
    anexarComprovante: false,
    imagemOrigem: undefined,
    modoRateio: 'padrao',
    rateioExclusivoId: todosSocios[0]?.id ?? '',
    rateioPercentuais: {},
    quantidadeTexto: '',
    precoCentavos: '',
    comprador: '',
    unidadeId: '',
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

// Traduz exatamente quais campos obrigatórios ainda estão vazios — o card de revisão mostra essa
// lista em vez de só uma borda colorida, pra o sócio não ter que reler o formulário inteiro
// tentando adivinhar o que falta.
function camposFaltando(l: LinhaEditavel, todosSocios: Socio[]): string[] {
  const faltando: string[] = [];
  if (!l.data) faltando.push('data');
  if (l.tipo === 'DESPESA') {
    if (!l.socioId) faltando.push('quem bancou');
    if (!(Number(l.valorCentavos) > 0)) faltando.push('valor');
    if (!rateioValido(l, todosSocios)) faltando.push('rateio (some 100%)');
  } else {
    if (!(Number(l.quantidadeTexto) > 0)) faltando.push('quantidade');
    if (!(Number(l.precoCentavos) > 0)) faltando.push('preço');
    if (!l.unidadeId) faltando.push('unidade');
  }
  return faltando;
}

// Resumo de uma linha (uma linha de texto), usado no card colapsado — o formulário completo só
// aparece quando o sócio toca pra expandir.
function resumoLinha(l: LinhaEditavel, unidades: UnidadeVenda[]): { titulo: string; valor: string } {
  if (l.tipo === 'DESPESA') {
    const categoria = ROTULO_TIPO_DESPESA[l.tipoDespesa] ?? 'Despesa';
    return {
      titulo: `${categoria}${l.descricao ? ' — ' + l.descricao : ''}`,
      valor: Number(l.valorCentavos) > 0 ? formatarMoeda(Number(l.valorCentavos) / 100) : '—',
    };
  }
  const unidadeNome = unidades.find((u) => u.id === l.unidadeId)?.nome ?? 'un.';
  const total =
    Number(l.quantidadeTexto) > 0 && Number(l.precoCentavos) > 0
      ? formatarMoeda((Number(l.quantidadeTexto) * Number(l.precoCentavos)) / 100)
      : '—';
  return { titulo: `Venda — ${l.quantidadeTexto || '?'} ${unidadeNome}`, valor: total };
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

  // Cards nascem colapsados (só resumo de uma linha) — expandem ao toque pra mostrar o
  // formulário completo. Reduz o quanto o sócio precisa rolar quando há muitos lançamentos.
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // Enquanto o sócio está mexendo dentro de um card (algum campo dele com foco), a SEÇÃO em que
  // o card aparece fica congelada no estado de quando começou a editar — sem isso, terminar de
  // digitar um valor (ex: valor > 0 já cumpre a validação) faz o card virar válido no meio da
  // digitação e pular pra outra seção da lista, debaixo do dedo do sócio. Ao tirar o foco do
  // card (clicar em outro lugar), o congelamento é liberado e o card migra sozinho pra seção
  // certa — sem exigir recolher manualmente. A cor/selo do card usa a validade ao vivo o tempo
  // todo (feedback imediato de "já está ok"), só a posição na lista espera esse momento.
  const [emEdicao, setEmEdicao] = useState<Set<string>>(new Set());
  const estadoCongeladoRef = useRef<Record<string, 'ok' | 'revisar'>>({});

  function marcarEmEdicao(id: string, entrando: boolean) {
    if (entrando) {
      setEmEdicao((atual) => (atual.has(id) ? atual : new Set(atual).add(id)));
      if (estadoCongeladoRef.current[id] === undefined) {
        const linha = linhas.find((l) => l.id === id);
        if (linha) estadoCongeladoRef.current[id] = linhaValida(linha, todosSocios) ? 'ok' : 'revisar';
      }
    } else {
      setEmEdicao((atual) => {
        if (!atual.has(id)) return atual;
        const novo = new Set(atual);
        novo.delete(id);
        return novo;
      });
      delete estadoCongeladoRef.current[id];
    }
  }
  // Revisão focada: atalho que abre um pendente por vez em tela cheia, com progresso e
  // avanço automático — por cima da mesma lista, nunca a única forma de revisar.
  const [revisaoFocada, setRevisaoFocada] = useState<{ ids: string[]; indice: number } | null>(null);

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

  // Só abre/fecha o formulário — o congelamento de seção depende de foco (`marcarEmEdicao`),
  // não de expandir/colapsar (ver comentário de `emEdicao`).
  function alternarExpandida(id: string) {
    setExpandidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // Insere no topo da lista (não no fim) — é onde o botão fixo fica, então a linha nova aparece
  // logo abaixo dele, sem o sócio precisar rolar até o final pra encontrar o que acabou de criar.
  // Já nasce expandida (o sócio veio justamente pra preencher os campos dela).
  function adicionarLinhaManual() {
    const linha = novaLinhaManual(meuId, socios, todosSocios);
    setLinhas((atual) => [linha, ...atual]);
    setExpandidas((atual) => new Set(atual).add(linha.id));
  }

  // Seção em que a linha aparece na lista agrupada — congelada enquanto o sócio está com o foco
  // em algum campo do card (ver comentário de `emEdicao`). A cor/selo do card (em `renderCard`)
  // usa a validade real, ao vivo, então o card pode ficar verde por dentro antes de mudar de seção.
  function secaoDaLinha(l: LinhaEditavel): 'ok' | 'revisar' {
    if (l.enviada) return 'ok';
    const congelado = emEdicao.has(l.id) ? estadoCongeladoRef.current[l.id] : undefined;
    if (congelado) return congelado;
    return linhaValida(l, todosSocios) ? 'ok' : 'revisar';
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
  const linhasPendentes = linhasAtivas.filter((l) => secaoDaLinha(l) === 'revisar');
  const linhasProntas = linhasAtivas.filter((l) => secaoDaLinha(l) === 'ok');
  const linhasDescartadas = linhas.filter((l) => l.descartada);
  const contagemProntas = linhasProntas.filter((l) => !l.enviada).length;
  const contagemRevisar = linhasPendentes.length;
  // Contagem real (sem o congelamento de seção) — usada no botão do atalho, já que ele monta a
  // fila com base na validade de verdade (ver `iniciarRevisaoFocada`); evita prometer um número
  // no botão diferente do que a revisão focada de fato vai mostrar.
  const contagemRevisarReal = linhasAtivas.filter((l) => !l.enviada && !linhaValida(l, todosSocios)).length;
  const contagemDescartadas = linhasDescartadas.length;

  // Atalho "Revisar pendentes agora": tira uma foto do que está pendente neste instante e passa
  // a andar por essa lista, uma de cada vez — tocar num card específico da lista continua
  // funcionando normalmente, em paralelo, este é só um caminho mais rápido por cima da mesma tela.
  // Usa a validade REAL (não a seção congelada de `secaoDaLinha`) — essa é uma ação deliberada
  // do sócio pra ver o que falta de verdade; um card que já está completo (mesmo ainda "preso"
  // na seção de revisão por estar aberto) não deve entrar nessa fila.
  function iniciarRevisaoFocada() {
    const ids = linhasAtivas.filter((l) => !l.enviada && !linhaValida(l, todosSocios)).map((l) => l.id);
    if (ids.length === 0) return;
    setRevisaoFocada({ ids, indice: 0 });
  }

  function avancarRevisaoFocada() {
    setRevisaoFocada((atual) => {
      if (!atual) return atual;
      if (atual.indice + 1 < atual.ids.length) return { ...atual, indice: atual.indice + 1 };
      return null;
    });
  }

  function voltarRevisaoFocada() {
    setRevisaoFocada((atual) => (atual && atual.indice > 0 ? { ...atual, indice: atual.indice - 1 } : atual));
  }

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

  // Corpo completo e editável de uma linha (campos de despesa ou venda) — reaproveitado tanto no
  // card expandido da lista normal quanto na revisão focada em tela cheia, pra não duplicar as
  // regras de validação/rateio/unidade em dois lugares.
  function corpoLinha(linha: LinhaEditavel) {
    return (
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
    );
  }

  // Card da lista normal — colapsado por padrão (resumo de uma linha + selo), expande ao toque
  // pra mostrar o corpo completo. `secao` é só a seção onde está posicionado (congelada durante
  // a edição, ver `secaoDaLinha`); a cor/selo usam a validade REAL, ao vivo — o card pode virar
  // verde por dentro assim que os campos ficam completos, antes de migrar fisicamente de seção.
  function renderCard(linha: LinhaEditavel, secao: 'revisar' | 'ok' | 'descartada') {
    const estado: 'revisar' | 'ok' | 'descartada' =
      secao === 'descartada' ? 'descartada' : linha.enviada || linhaValida(linha, todosSocios) ? 'ok' : 'revisar';
    const faltando = estado === 'revisar' ? camposFaltando(linha, todosSocios) : [];
    const resumo = resumoLinha(linha, unidades);
    const expandida = expandidas.has(linha.id);

    return (
      <div
        key={linha.id}
        className={cn(
          'flex flex-col gap-3 rounded-2xl border-[1.5px] p-3.5',
          estado === 'descartada' && 'border-hf-line bg-hf-cream-100 opacity-60',
          estado === 'revisar' && 'border-hf-red bg-hf-red-bg',
          estado === 'ok' && 'border-hf-green-600 bg-hf-green-100'
        )}
      >
        <button
          type="button"
          onClick={() => estado !== 'descartada' && alternarExpandida(linha.id)}
          disabled={estado === 'descartada'}
          className="flex w-full items-center gap-2 text-left"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {linha.manual ? (
                <span className="flex items-center gap-1 rounded-full bg-hf-blue-bg px-2 py-0.5 text-[10px] font-bold text-hf-blue">
                  <PenLine className="h-2.5 w-2.5" strokeWidth={2.6} />
                  Adicionado por você
                </span>
              ) : (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    linha.confianca === 'ALTA' ? 'bg-white/70 text-hf-green-800' : 'bg-white/70 text-hf-amber'
                  )}
                >
                  Confiança {linha.confianca === 'ALTA' ? 'alta' : 'baixa'}
                </span>
              )}
              {linha.enviada && (
                <span className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-hf-green-800">
                  <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.6} />
                  Importado
                </span>
              )}
              {faltando.length > 0 && (
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-hf-red">
                  Falta: {faltando.join(', ')}
                </span>
              )}
            </div>
            {!expandida && (
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-bold text-hf-stone-900">{resumo.titulo}</span>
                <span className="shrink-0 text-[12.5px] font-bold text-hf-stone-700">{resumo.valor}</span>
              </div>
            )}
          </div>
          {estado !== 'descartada' &&
            (expandida ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-hf-stone-400" strokeWidth={2.4} />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-hf-stone-400" strokeWidth={2.4} />
            ))}
        </button>

        {!linha.enviada && estado !== 'descartada' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alternarDescarte(linha.id);
            }}
            className="-mt-2 flex w-fit items-center gap-1 text-[11px] font-bold text-hf-stone-600"
          >
            <Trash2 className="h-3 w-3" strokeWidth={2.4} /> Descartar
          </button>
        )}
        {estado === 'descartada' && (
          <button
            type="button"
            onClick={() => alternarDescarte(linha.id)}
            className="-mt-2 flex w-fit items-center gap-1 text-[11px] font-bold text-hf-stone-400"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.4} /> Restaurar
          </button>
        )}

        {expandida && estado !== 'descartada' && (
          <div
            className="flex flex-col gap-3"
            onFocus={() => marcarEmEdicao(linha.id, true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) marcarEmEdicao(linha.id, false);
            }}
          >
            {corpoLinha(linha)}
          </div>
        )}

        {/* Card congelado em "revisão" (`secao`) mas já válido de verdade (`estado`) — acontece
            enquanto o campo que faltava continua com foco (ex: um <select> nativo não perde o
            foco sozinho depois de escolher a opção). Em vez de esperar o sócio adivinhar que
            precisa clicar fora, este botão libera o congelamento na hora. Fica no fim do card
            (depois do formulário) e com cor sólida — é a ação que fecha aquele lançamento. */}
        {expandida && estado === 'ok' && secao === 'revisar' && (
          <button
            type="button"
            onClick={() => marcarEmEdicao(linha.id, false)}
            className="flex items-center justify-center gap-2 rounded-xl bg-hf-green-800 py-3 text-[13px] font-bold text-white"
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} />
            Tudo certo aqui — toque para confirmar
          </button>
        )}
      </div>
    );
  }

  // Revisão focada em tela cheia (atalho "Revisar pendentes agora") — anda pelos ids
  // "fotografados" no momento em que foi aberta, um card por vez.
  if (revisaoFocada) {
    const linhaAtual = linhas.find((l) => l.id === revisaoFocada.ids[revisaoFocada.indice]);
    const faltandoAtual = linhaAtual ? camposFaltando(linhaAtual, todosSocios) : [];
    const podeAvancar = !!linhaAtual && linhaValida(linhaAtual, todosSocios);

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-hf-cream-50">
        <div className="border-b border-hf-cream-100 bg-white px-[18px] pb-3 pt-2.5">
          <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
            <button
              type="button"
              aria-label="Fechar revisão focada"
              onClick={() => setRevisaoFocada(null)}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.3} />
            </button>
            <h2 className="truncate text-center font-rounded text-[15px] font-extrabold text-hf-stone-900">Revisão rápida</h2>
            <div className="h-[38px] w-[38px]" />
          </div>
          <div className="mx-auto mt-3 w-full max-w-sm">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-hf-cream-100">
              <div
                className="h-full rounded-full bg-hf-green-800 transition-all"
                style={{ width: `${((revisaoFocada.indice + 1) / revisaoFocada.ids.length) * 100}%` }}
              />
            </div>
            <p className="m-0 mt-1.5 text-[11.5px] font-bold text-hf-stone-600">
              Lançamento {revisaoFocada.indice + 1} de {revisaoFocada.ids.length}
            </p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-5">
          {linhaAtual ? (
            <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-hf-red bg-hf-red-bg p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-hf-red">
                  Falta: {faltandoAtual.join(', ') || 'confira os campos'}
                </span>
              </div>
              {corpoLinha(linhaAtual)}
            </div>
          ) : (
            <p className="text-center text-sm text-hf-stone-600">Este lançamento não está mais disponível.</p>
          )}
        </div>

        <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
          <div className="mx-auto flex w-full max-w-sm gap-2.5">
            {revisaoFocada.indice > 0 && (
              <button
                type="button"
                onClick={voltarRevisaoFocada}
                aria-label="Lançamento anterior"
                className="flex shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-hf-line px-4 text-hf-stone-700"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (linhaAtual) alternarDescarte(linhaAtual.id);
                avancarRevisaoFocada();
              }}
              className="flex-1 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-[13px] font-bold text-hf-red"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={avancarRevisaoFocada}
              disabled={!podeAvancar}
              className="flex-[1.4] rounded-2xl bg-hf-green-800 py-3.5 text-[13px] font-bold text-white disabled:opacity-40"
            >
              Confirmar e avançar
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-[22px] pb-28 pt-[18px]">
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
            {/* Fixa logo abaixo do cabeçalho — o resumo de status e o atalho de revisão focada
                precisam estar sempre à mão, sem depender de rolar até o topo ou o fim da lista. */}
            <div className="sticky top-[52px] z-[5] -mx-[22px] flex flex-col gap-2 bg-hf-cream-50 px-[22px] py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 rounded-2xl bg-hf-cream-100 px-3.5 py-2.5 text-[11.5px] font-bold leading-tight text-hf-stone-700">
                  {contagemProntas} pronta{contagemProntas === 1 ? '' : 's'} · {contagemRevisar} precisa
                  {contagemRevisar === 1 ? '' : 'm'} de revisão · {contagemDescartadas} descartada
                  {contagemDescartadas === 1 ? '' : 's'}
                </div>
                <button
                  type="button"
                  onClick={adicionarLinhaManual}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-hf-green-800 px-3 py-2.5 text-[11.5px] font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Adicionar
                </button>
              </div>
              {contagemRevisarReal > 0 && (
                <button
                  type="button"
                  onClick={iniciarRevisaoFocada}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hf-green-900 py-2.5 text-[12.5px] font-bold text-white shadow-[0_0_0_3px_rgba(30,107,62,0.18)]"
                >
                  <ListChecks className="h-4 w-4" strokeWidth={2.2} />
                  Revisar pendentes agora ({contagemRevisarReal})
                </button>
              )}
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-hf-blue-bg px-3.5 py-3">
              <Info className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-blue" strokeWidth={2} />
              <p className="m-0 text-[11.5px] text-hf-blue">
                A IA pode deixar algum lançamento de fora, principalmente em letra difícil de ler. Confira cada
                linha contra o papel/arquivo original antes de confirmar — achou algo faltando? Use "Adicionar" acima.
              </p>
            </div>

            {arquivosSemLeitura.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl bg-hf-amber-bg px-3.5 py-3">
                <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-amber" strokeWidth={2} />
                <p className="m-0 text-[11.5px] text-hf-amber">
                  Não conseguimos identificar nenhum lançamento em: {arquivosSemLeitura.map((i) => nomesArquivos[i]).join(', ')}.
                  Considere tirar a foto de novo se esperava encontrar algo ali.
                </p>
              </div>
            )}

            {linhas.length === 0 && (
              <p className="text-center text-sm text-hf-stone-600">Nenhum lançamento identificado nos arquivos enviados.</p>
            )}

            {linhasPendentes.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-wide text-hf-red">
                  Precisam de revisão ({linhasPendentes.length})
                </p>
                {linhasPendentes.map((linha) => renderCard(linha, 'revisar'))}
              </div>
            )}

            {linhasProntas.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-wide text-hf-green-700">
                  Prontas para importar ({linhasProntas.length})
                </p>
                {linhasProntas.map((linha) => renderCard(linha, 'ok'))}
              </div>
            )}

            {linhasDescartadas.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-wide text-hf-stone-400">
                  Descartadas ({linhasDescartadas.length})
                </p>
                {linhasDescartadas.map((linha) => renderCard(linha, 'descartada'))}
              </div>
            )}
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
        // `fixed` (não só um div no fim do conteúdo) — sem isso, com a lista de revisão longa,
        // o botão só aparecia depois de rolar tudo, e o sócio não tinha como saber se já dava
        // pra importar sem chegar ao fim da página.
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hf-cream-100 bg-white px-[22px] py-4">
          <div className="mx-auto w-full max-w-sm">
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
        </div>
      )}
    </div>
  );
}
