import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  ArrowLeft,
  Camera,
  Images,
  FileText,
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
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useConectividade } from '../lib/useConectividade';
import { obterSociosCache } from '../lib/sociedadesCache';
import { listarSociosRequest } from '../services/sociedades';
import { obterUnidadesVendaCache, salvarUnidadesVendaCache } from '../lib/unidadesVendaCache';
import { listarUnidadesRequest } from '../services/unidadesVenda';
import { criarUnidadeRequest } from '../services/unidadesVenda';
import { extrairImportacaoRequest } from '../services/importacao';
import { criarDespesa } from '../lib/despesasQueue';
import { criarVenda } from '../lib/vendasQueue';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { DateSelectorChip } from '../components/DateSelectorChip';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { formatarMoeda } from '../lib/formatacao';
import { hojeISO } from '../lib/data';
import { cores, espacamento, raio } from '../theme';
import type { Socio } from '../types/sociedade';
import type { UnidadeVenda } from '../types/unidadeVenda';
import type { LinhaExtraida, TipoLancamentoSugerido } from '../types/importacao';
import type { TipoDespesa } from '../types/despesa';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportarLancamentos'>;

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

type ModoRateio = 'padrao' | 'exclusivo' | 'personalizado';
type ModoArquivo = 'fotos' | 'documento' | null;

interface ArquivoInput {
  nome: string;
  base64: string;
}

interface LinhaEditavel {
  id: string;
  confianca: 'ALTA' | 'BAIXA';
  manual: boolean;
  tipo: TipoLancamentoSugerido;
  descartada: boolean;
  enviada: boolean;
  data: string;
  tipoDespesa: TipoDespesa;
  socioId: string;
  valorCentavos: string;
  descricao: string;
  anexarComprovante: boolean;
  imagemOrigem?: string;
  modoRateio: ModoRateio;
  rateioExclusivoId: string;
  rateioPercentuais: Record<string, string>;
  quantidadeTexto: string;
  precoCentavos: string;
  comprador: string;
  unidadeId: string;
  pago: boolean;
}

function paraLinhaEditavel(
  linha: LinhaExtraida,
  meuId: string | null,
  sociosComConta: Socio[],
  socios: Socio[],
  unidades: UnidadeVenda[]
): LinhaEditavel {
  const nomeSugerido = linha.unidade_nome_sugerido?.trim().toLowerCase();
  const unidadeCorrespondente = nomeSugerido ? unidades.find((u) => u.nome.trim().toLowerCase() === nomeSugerido) : undefined;
  const socioPadrao = sociosComConta.find((s) => s.usuario_id === meuId) ?? sociosComConta[0];

  return {
    id: `${linha.origem_arquivo_index}-${Math.random().toString(36).slice(2, 9)}`,
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
    rateioExclusivoId: socios[0]?.id ?? '',
    rateioPercentuais: {},
    quantidadeTexto: linha.quantidade ? String(linha.quantidade) : '',
    precoCentavos: linha.preco ? String(Math.round(linha.preco * 100)) : '',
    comprador: linha.comprador ?? '',
    unidadeId: unidadeCorrespondente?.id ?? '',
    pago: false,
  };
}

function novaLinhaManual(meuId: string | null, sociosComConta: Socio[], socios: Socio[]): LinhaEditavel {
  const socioPadrao = sociosComConta.find((s) => s.usuario_id === meuId) ?? sociosComConta[0];
  return {
    id: `manual-${Math.random().toString(36).slice(2, 9)}`,
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
    rateioExclusivoId: socios[0]?.id ?? '',
    rateioPercentuais: {},
    quantidadeTexto: '',
    precoCentavos: '',
    comprador: '',
    unidadeId: '',
    pago: false,
  };
}

function splitPercentuaisMultiplosDe5(n: number): number[] {
  const totalFatias = 20;
  const base = Math.floor(totalFatias / n);
  const resto = totalFatias - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) * 5);
}

function rateioValido(l: LinhaEditavel, socios: Socio[]): boolean {
  if (l.modoRateio === 'padrao') return true;
  if (l.modoRateio === 'exclusivo') return !!l.rateioExclusivoId;
  const soma = socios.reduce((acc, s) => acc + (Number(l.rateioPercentuais[s.id]?.replace(',', '.')) || 0), 0);
  return Math.abs(soma - 100) <= 0.01;
}

function linhaValida(l: LinhaEditavel, socios: Socio[]): boolean {
  if (l.tipo === 'DESPESA') {
    return !!l.data && !!l.socioId && Number(l.valorCentavos) > 0 && rateioValido(l, socios);
  }
  return !!l.data && Number(l.quantidadeTexto) > 0 && Number(l.precoCentavos) > 0 && !!l.unidadeId;
}

// Traduz exatamente quais campos obrigatórios ainda estão vazios — o card de revisão mostra essa
// lista em vez de só uma cor, pra o sócio não ter que reler o formulário inteiro adivinhando o
// que falta (docs/specs/mobile/12, adendo de UX portado do web).
function camposFaltando(l: LinhaEditavel, socios: Socio[]): string[] {
  const faltando: string[] = [];
  if (!l.data) faltando.push('data');
  if (l.tipo === 'DESPESA') {
    if (!l.socioId) faltando.push('quem bancou');
    if (!(Number(l.valorCentavos) > 0)) faltando.push('valor');
    if (!rateioValido(l, socios)) faltando.push('rateio (some 100%)');
  } else {
    if (!(Number(l.quantidadeTexto) > 0)) faltando.push('quantidade');
    if (!(Number(l.precoCentavos) > 0)) faltando.push('preço');
    if (!l.unidadeId) faltando.push('unidade');
  }
  return faltando;
}

// Resumo de uma linha (usado no card colapsado) — o formulário completo só aparece quando o
// sócio toca pra expandir.
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

function rateioParaEnviar(l: LinhaEditavel, socios: Socio[]): { socio_id: string; percentual: number }[] | undefined {
  if (l.modoRateio === 'padrao') return undefined;
  if (l.modoRateio === 'exclusivo') return l.rateioExclusivoId ? [{ socio_id: l.rateioExclusivoId, percentual: 100 }] : undefined;
  return socios
    .map((s) => ({ socio_id: s.id, percentual: Number(l.rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
    .filter((r) => r.percentual > 0);
}

type Etapa = 'upload' | 'revisao' | 'resumo';

// Tela de importação por IA (docs/specs/mobile/12-importacao-por-ia.md), equivalente à
// frontend/src/pages/ImportarLancamentosPage.tsx do web — inclusive a reorganização da revisão
// por status (agrupada + revisão focada) e o congelamento de seção por edição, portados do web
// depois de validados lá. A extração exige internet (chamada à API do Gemini) — sem conexão, o
// botão "Analisar" fica desabilitado com aviso explícito, em vez de tentar enfileirar algo que
// não existe ainda. Depois de extraído, a confirmação de cada linha reaproveita
// `criarDespesa`/`criarVenda` da fila offline já existente — nunca falha por falta de rede, então
// (diferente do web) não precisa de lógica própria de retry parcial.
export function ImportarLancamentosScreen({ navigation, route }: Props) {
  const { safraId, sociedadeId } = route.params;
  const { usuario } = useAuth();
  const conectado = useConectividade();

  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [socios, setSocios] = useState<Socio[]>([]);
  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);

  const [modoArquivo, setModoArquivo] = useState<ModoArquivo>(null);
  const [arquivos, setArquivos] = useState<ArquivoInput[]>([]);

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
  // Enquanto o sócio está digitando em algum campo do card, a SEÇÃO em que ele aparece fica
  // congelada no estado de quando começou a editar — sem isso, terminar de digitar um valor faz
  // o card virar válido no meio da digitação e pular pra outra seção da lista, debaixo do dedo
  // do sócio. Ao sair do campo (perder o foco), o congelamento é liberado com uma pequena folga
  // (RN não tem "relatedTarget" como o DOM web, então usamos um timeout curto pra absorver o
  // caso comum de trocar de campo dentro do mesmo card sem descongelar à toa). A cor do card usa
  // a validade ao vivo o tempo todo — só a posição na lista espera esse momento.
  const [emEdicao, setEmEdicao] = useState<Set<string>>(new Set());
  const estadoCongeladoRef = useRef<Record<string, 'ok' | 'revisar'>>({});
  const blurTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Revisão focada: atalho que abre um pendente por vez em tela cheia, com progresso e avanço
  // automático — por cima da mesma lista, nunca a única forma de revisar.
  const [revisaoFocada, setRevisaoFocada] = useState<{ ids: string[]; indice: number } | null>(null);

  function marcarEmEdicao(id: string, entrando: boolean) {
    if (entrando) {
      if (blurTimersRef.current[id]) {
        clearTimeout(blurTimersRef.current[id]);
        delete blurTimersRef.current[id];
      }
      setEmEdicao((atual) => (atual.has(id) ? atual : new Set(atual).add(id)));
      if (estadoCongeladoRef.current[id] === undefined) {
        const linha = linhas.find((l) => l.id === id);
        if (linha) estadoCongeladoRef.current[id] = linhaValida(linha, socios) ? 'ok' : 'revisar';
      }
      return;
    }
    blurTimersRef.current[id] = setTimeout(() => {
      delete blurTimersRef.current[id];
      setEmEdicao((atual) => {
        if (!atual.has(id)) return atual;
        const novo = new Set(atual);
        novo.delete(id);
        return novo;
      });
      delete estadoCongeladoRef.current[id];
    }, 200);
  }

  useEffect(() => {
    (async () => {
      const cacheSocios = await obterSociosCache(sociedadeId);
      if (cacheSocios.length > 0) setSocios(cacheSocios);
      const cacheUnidades = await obterUnidadesVendaCache(sociedadeId);
      if (cacheUnidades.length > 0) setUnidades(cacheUnidades);

      try {
        const [resSocios, resUnidades] = await Promise.all([
          listarSociosRequest(sociedadeId),
          listarUnidadesRequest(sociedadeId),
        ]);
        setSocios(resSocios.socios);
        setUnidades(resUnidades.unidades);
        await salvarUnidadesVendaCache(sociedadeId, resUnidades.unidades);
      } catch {
        // offline: segue só com o que já estava em cache
      }
    })();
  }, [sociedadeId]);

  const sociosComConta = socios.filter((s) => s.usuario_id);

  function registrarFotos(novos: ArquivoInput[]) {
    setArquivos((atual) => (modoArquivo === 'fotos' ? [...atual, ...novos] : novos));
    setModoArquivo('fotos');
    setErro(null);
  }

  function registrarDocumento(novo: ArquivoInput) {
    setArquivos([novo]);
    setModoArquivo('documento');
    setErro(null);
  }

  function removerArquivo(index: number) {
    setArquivos((atual) => atual.filter((_, i) => i !== index));
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para tirar a foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
    if (resultado.canceled || !resultado.assets?.[0]?.base64) return;
    registrarFotos([{ nome: `foto-${Date.now()}.jpg`, base64: `data:image/jpeg;base64,${resultado.assets[0].base64}` }]);
  }

  async function escolherDaGaleria() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para escolher fotos.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (resultado.canceled) return;
    const novos = resultado.assets
      .filter((a) => a.base64)
      .map((a, i) => ({
        nome: a.fileName ?? `galeria-${Date.now()}-${i}.jpg`,
        base64: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`,
      }));
    if (novos.length > 0) registrarFotos(novos);
  }

  async function escolherArquivo() {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets?.[0]) return;
    const asset = resultado.assets[0];
    try {
      const arquivo = new File(asset.uri);
      const base64 = await arquivo.base64();
      registrarDocumento({ nome: asset.name, base64: `data:${asset.mimeType ?? 'application/octet-stream'};base64,${base64}` });
    } catch {
      setErro('Não foi possível ler esse arquivo');
    }
  }

  async function analisar() {
    if (arquivos.length === 0 || !conectado) return;
    setErro(null);
    setAnalisando(true);
    try {
      const resultado = await extrairImportacaoRequest(safraId, arquivos);
      setLinhas(resultado.linhas.map((l) => paraLinhaEditavel(l, usuario?.id ?? null, sociosComConta, socios, unidades)));
      setArquivosSemLeitura(resultado.arquivos_sem_leitura);
      setEtapa('revisao');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível analisar os arquivos agora. Tente novamente em instantes.');
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

  // Só abre/fecha o formulário — o congelamento de seção depende de foco (`marcarEmEdicao`), não
  // de expandir/colapsar.
  function alternarExpandida(id: string) {
    setExpandidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function adicionarLinhaManual() {
    const linha = novaLinhaManual(usuario?.id ?? null, sociosComConta, socios);
    setLinhas((atual) => [linha, ...atual]);
    setExpandidas((atual) => new Set(atual).add(linha.id));
  }

  // Seção em que a linha aparece na lista agrupada — congelada enquanto o sócio está com o foco
  // em algum campo do card. A cor/selo do card (em `renderCard`) usa a validade real, ao vivo,
  // então o card pode ficar verde por dentro antes de migrar fisicamente de seção.
  function secaoDaLinha(l: LinhaEditavel): 'ok' | 'revisar' {
    if (l.enviada) return 'ok';
    const congelado = emEdicao.has(l.id) ? estadoCongeladoRef.current[l.id] : undefined;
    if (congelado) return congelado;
    return linhaValida(l, socios) ? 'ok' : 'revisar';
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
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a unidade de venda');
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
  // Contagem real (sem o congelamento de seção) — usada no atalho de revisão focada, já que ele
  // monta a fila com base na validade de verdade, não na posição congelada na lista passiva.
  const contagemRevisarReal = linhasAtivas.filter((l) => !l.enviada && !linhaValida(l, socios)).length;

  function iniciarRevisaoFocada() {
    const ids = linhasAtivas.filter((l) => !l.enviada && !linhaValida(l, socios)).map((l) => l.id);
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
    const pendentes = linhas.filter((l) => !l.descartada && !l.enviada && linhaValida(l, socios));
    try {
      for (const linha of pendentes) {
        if (linha.tipo === 'DESPESA') {
          const socioNome = sociosComConta.find((s) => s.usuario_id === linha.socioId)?.nome ?? '';
          const sociosParaRateio = socios.map((s) => ({ id: s.id, nome: s.nome }));
          await criarDespesa(
            safraId,
            {
              socio_id: linha.socioId,
              tipo: linha.tipoDespesa,
              valor: Number(linha.valorCentavos) / 100,
              data: linha.data,
              foto_comprovante: linha.anexarComprovante ? linha.imagemOrigem : undefined,
              descricao: linha.descricao.trim() || undefined,
              rateio: rateioParaEnviar(linha, socios),
            },
            socioNome,
            sociosParaRateio
          );
        } else {
          const unidadeNome = unidades.find((u) => u.id === linha.unidadeId)?.nome ?? '';
          await criarVenda(
            safraId,
            {
              data: linha.data,
              quantidade: Number(linha.quantidadeTexto),
              preco: Number(linha.precoCentavos) / 100,
              comprador: linha.comprador.trim() || undefined,
              unidade_id: linha.unidadeId,
              pago: linha.pago,
            },
            unidadeNome
          );
        }
        setLinhas((atual) => atual.map((x) => (x.id === linha.id ? { ...x, enviada: true } : x)));
      }
      setEtapa('resumo');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar os lançamentos');
    } finally {
      setConfirmando(false);
    }
  }

  const totalEnviadasDespesa = linhas.filter((l) => l.enviada && l.tipo === 'DESPESA').length;
  const totalEnviadasVenda = linhas.filter((l) => l.enviada && l.tipo === 'VENDA').length;

  // Corpo completo e editável de uma linha — reaproveitado no card expandido da lista normal e
  // na revisão focada em tela cheia. Cada TextInput chama `marcarEmEdicao` no foco/blur pra
  // alimentar o congelamento de seção (RN não borbulha foco por View como o DOM web).
  function corpoLinha(linha: LinhaEditavel) {
    const onFocusCampo = () => marcarEmEdicao(linha.id, true);
    const onBlurCampo = () => marcarEmEdicao(linha.id, false);

    return (
      <>
        <View style={{ flexDirection: 'row', gap: espacamento.sm }}>
          {(['DESPESA', 'VENDA'] as const).map((t) => {
            const ativo = linha.tipo === t;
            return (
              <Pressable
                key={t}
                style={[styles.tipoBotao, ativo && styles.tipoBotaoAtivo]}
                onPress={() => atualizarLinha(linha.id, { tipo: t })}
                disabled={linha.enviada}
              >
                <Text style={[styles.tipoBotaoTexto, ativo && styles.tipoBotaoTextoAtivo]}>
                  {t === 'DESPESA' ? 'Despesa' : 'Venda'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View>
          <Text style={styles.label}>Data</Text>
          <DateSelectorChip
            value={linha.data || hojeISO()}
            onChange={(v) => atualizarLinha(linha.id, { data: v })}
          />
          {!linha.data && <Text style={styles.campoErro}>Preencha a data</Text>}
        </View>

        {linha.tipo === 'DESPESA' ? (
          <>
            <View>
              <Text style={styles.label}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.linhaChips}>
                  {TIPOS_DESPESA.map((t) => {
                    const ativo = linha.tipoDespesa === t;
                    return (
                      <Pressable
                        key={t}
                        style={[styles.chip, ativo && styles.chipAtivo]}
                        onPress={() => atualizarLinha(linha.id, { tipoDespesa: t })}
                        disabled={linha.enviada}
                      >
                        <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                          {ROTULO_TIPO_DESPESA[t]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>Quem bancou?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.linhaChips}>
                  {sociosComConta.map((s) => {
                    const ativo = s.usuario_id === linha.socioId;
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, ativo && styles.chipAtivo]}
                        onPress={() => atualizarLinha(linha.id, { socioId: s.usuario_id! })}
                        disabled={linha.enviada}
                      >
                        <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{s.nome}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>Quem paga essa despesa?</Text>
              <View style={{ flexDirection: 'row', gap: espacamento.xs + 2 }}>
                {(
                  [
                    { modo: 'padrao' as const, titulo: 'Como o lucro' },
                    { modo: 'exclusivo' as const, titulo: 'Só um sócio' },
                    { modo: 'personalizado' as const, titulo: 'Personalizado' },
                  ]
                ).map(({ modo, titulo }) => {
                  const ativo = linha.modoRateio === modo;
                  return (
                    <Pressable
                      key={modo}
                      style={[styles.rateioBotao, ativo && styles.rateioBotaoAtivo]}
                      disabled={linha.enviada}
                      onPress={() =>
                        atualizarLinha(linha.id, {
                          modoRateio: modo,
                          rateioPercentuais:
                            modo === 'personalizado' && Object.keys(linha.rateioPercentuais).length === 0
                              ? Object.fromEntries(
                                  socios.map((s, i) => [s.id, String(splitPercentuaisMultiplosDe5(socios.length)[i])])
                                )
                              : linha.rateioPercentuais,
                        })
                      }
                    >
                      <Text style={[styles.rateioBotaoTexto, ativo && styles.rateioBotaoTextoAtivo]}>{titulo}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {linha.modoRateio === 'exclusivo' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: espacamento.sm }}>
                  <View style={styles.linhaChips}>
                    {socios.map((s) => {
                      const ativo = s.id === linha.rateioExclusivoId;
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, ativo && styles.chipAtivo]}
                          onPress={() => atualizarLinha(linha.id, { rateioExclusivoId: s.id })}
                          disabled={linha.enviada}
                        >
                          <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{s.nome}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {linha.modoRateio === 'personalizado' && (
                <View style={styles.blocoRateio}>
                  {socios.map((s) => {
                    const valor = Number(linha.rateioPercentuais[s.id]?.replace(',', '.')) || 0;
                    return (
                      <View key={s.id} style={styles.linhaPercentual}>
                        <Text style={styles.linhaPercentualNome} numberOfLines={1}>
                          {s.nome}
                        </Text>
                        <TextInput
                          style={styles.inputPercentual}
                          value={String(valor)}
                          keyboardType="numeric"
                          editable={!linha.enviada}
                          onFocus={onFocusCampo}
                          onBlur={onBlurCampo}
                          onChangeText={(texto) =>
                            atualizarLinha(linha.id, {
                              rateioPercentuais: {
                                ...linha.rateioPercentuais,
                                [s.id]: texto.replace(/\D/g, '').slice(0, 3),
                              },
                            })
                          }
                        />
                        <Text style={styles.percentualSinal}>%</Text>
                      </View>
                    );
                  })}
                  {!rateioValido(linha, socios) && (
                    <Text style={styles.campoErro}>A soma precisa fechar em 100%</Text>
                  )}
                </View>
              )}
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.label, { textAlign: 'center' }]}>Valor</Text>
              <View style={styles.valorLinha}>
                <Text style={styles.valorPrefixo}>R$</Text>
                <TextInput
                  style={styles.valorInput}
                  value={formatarValorMascara(linha.valorCentavos)}
                  onFocus={onFocusCampo}
                  onBlur={onBlurCampo}
                  onChangeText={(texto) =>
                    atualizarLinha(linha.id, { valorCentavos: texto.replace(/\D/g, '').slice(0, 9) })
                  }
                  placeholder="0,00"
                  placeholderTextColor={cores.stone[400]}
                  keyboardType="numeric"
                  editable={!linha.enviada}
                />
              </View>
            </View>

            <TextInput
              style={styles.input}
              value={linha.descricao}
              onChangeText={(texto) => atualizarLinha(linha.id, { descricao: texto })}
              onFocus={onFocusCampo}
              onBlur={onBlurCampo}
              placeholder="Descrição (opcional)"
              placeholderTextColor={cores.stone[400]}
              editable={!linha.enviada}
            />

            {linha.imagemOrigem && (
              <View style={styles.linhaToggle}>
                <Text style={styles.toggleTitulo}>Anexar imagem como comprovante</Text>
                <Switch
                  value={linha.anexarComprovante}
                  onValueChange={(v) => atualizarLinha(linha.id, { anexarComprovante: v })}
                  trackColor={{ false: cores.cream[100], true: cores.green[800] }}
                  thumbColor="#FFFFFF"
                  disabled={linha.enviada}
                />
              </View>
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: espacamento.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Quantidade</Text>
                <TextInput
                  style={styles.input}
                  value={linha.quantidadeTexto}
                  onFocus={onFocusCampo}
                  onBlur={onBlurCampo}
                  onChangeText={(texto) =>
                    atualizarLinha(linha.id, { quantidadeTexto: texto.replace(/\D/g, '').slice(0, 4) })
                  }
                  keyboardType="numeric"
                  editable={!linha.enviada}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Preço unitário</Text>
                <View style={styles.valorLinhaPequena}>
                  <Text style={styles.valorPrefixoPequeno}>R$</Text>
                  <TextInput
                    style={styles.valorInputPequeno}
                    value={formatarValorMascara(linha.precoCentavos)}
                    onFocus={onFocusCampo}
                    onBlur={onBlurCampo}
                    onChangeText={(texto) =>
                      atualizarLinha(linha.id, { precoCentavos: texto.replace(/\D/g, '').slice(0, 9) })
                    }
                    placeholder="0,00"
                    placeholderTextColor={cores.stone[400]}
                    keyboardType="numeric"
                    editable={!linha.enviada}
                  />
                </View>
              </View>
            </View>

            {Number(linha.quantidadeTexto) > 0 && Number(linha.precoCentavos) > 0 && (
              <Text style={styles.totalLinha}>
                Total:{' '}
                <Text style={{ fontWeight: '800' }}>
                  {formatarMoeda((Number(linha.quantidadeTexto) * Number(linha.precoCentavos)) / 100)}
                </Text>
              </Text>
            )}

            <View>
              <Text style={styles.label}>Unidade</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.linhaChips}>
                  {unidades.map((u) => {
                    const ativo = u.id === linha.unidadeId;
                    return (
                      <Pressable
                        key={u.id}
                        style={[styles.chip, ativo && styles.chipAtivo]}
                        onPress={() => atualizarLinha(linha.id, { unidadeId: u.id })}
                        disabled={linha.enviada}
                      >
                        <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{u.nome}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {!linha.unidadeId && !linha.enviada && (
                <View style={{ flexDirection: 'row', gap: espacamento.sm, marginTop: espacamento.sm }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={nomeNovaUnidade[linha.id] ?? ''}
                    onFocus={onFocusCampo}
                    onBlur={onBlurCampo}
                    onChangeText={(texto) => setNomeNovaUnidade((atual) => ({ ...atual, [linha.id]: texto }))}
                    placeholder="ou crie uma nova, ex: Caixa"
                    placeholderTextColor={cores.stone[400]}
                  />
                  <Pressable
                    style={styles.botaoCriarUnidade}
                    disabled={!nomeNovaUnidade[linha.id]?.trim() || criandoUnidade === linha.id}
                    onPress={() => criarUnidadeParaLinha(linha)}
                  >
                    {criandoUnidade === linha.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.botaoCriarUnidadeTexto}>Criar</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            <TextInput
              style={styles.input}
              value={linha.comprador}
              onFocus={onFocusCampo}
              onBlur={onBlurCampo}
              onChangeText={(texto) => atualizarLinha(linha.id, { comprador: texto })}
              placeholder="Comprador (opcional)"
              placeholderTextColor={cores.stone[400]}
              editable={!linha.enviada}
            />

            <View style={styles.linhaToggle}>
              <Text style={styles.toggleTitulo}>Já foi pago</Text>
              <Switch
                value={linha.pago}
                onValueChange={(v) => atualizarLinha(linha.id, { pago: v })}
                trackColor={{ false: cores.cream[100], true: cores.green[800] }}
                thumbColor="#FFFFFF"
                disabled={linha.enviada}
              />
            </View>
          </>
        )}
      </>
    );
  }

  // Card da lista normal — colapsado por padrão (resumo de uma linha + selo), expande ao toque
  // pra mostrar o corpo completo. `secao` é só a seção onde está posicionado (congelada durante
  // a edição); a cor/selo usam a validade real, ao vivo — o card pode virar verde por dentro
  // assim que os campos ficam completos, antes de migrar fisicamente de seção.
  function renderCard(linha: LinhaEditavel, secao: 'revisar' | 'ok' | 'descartada') {
    const estado: 'revisar' | 'ok' | 'descartada' =
      secao === 'descartada' ? 'descartada' : linha.enviada || linhaValida(linha, socios) ? 'ok' : 'revisar';
    const faltando = estado === 'revisar' ? camposFaltando(linha, socios) : [];
    const resumo = resumoLinha(linha, unidades);
    const expandida = expandidas.has(linha.id);

    return (
      <View
        key={linha.id}
        style={[
          styles.card,
          estado === 'descartada' && styles.cardDescartado,
          estado === 'revisar' && styles.cardRevisar,
          estado === 'ok' && styles.cardOk,
        ]}
      >
        <Pressable
          onPress={() => estado !== 'descartada' && alternarExpandida(linha.id)}
          disabled={estado === 'descartada'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento.sm }}
        >
          <View style={{ flex: 1, gap: espacamento.xs + 2 }}>
            <View style={styles.cardTopo}>
              {linha.manual ? (
                <View style={[styles.selo, { backgroundColor: cores.blue.fundo }]}>
                  <PenLine size={11} color={cores.blue.padrao} strokeWidth={2.6} />
                  <Text style={[styles.seloTexto, { color: cores.blue.padrao }]}>Adicionado por você</Text>
                </View>
              ) : (
                <View style={[styles.selo, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                  <Text
                    style={[
                      styles.seloTexto,
                      { color: linha.confianca === 'ALTA' ? cores.green[800] : cores.amber.padrao },
                    ]}
                  >
                    Confiança {linha.confianca === 'ALTA' ? 'alta' : 'baixa'}
                  </Text>
                </View>
              )}
              {linha.enviada && (
                <View style={[styles.selo, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                  <CheckCircle2 size={11} color={cores.green[800]} strokeWidth={2.6} />
                  <Text style={[styles.seloTexto, { color: cores.green[800] }]}>Importado</Text>
                </View>
              )}
              {faltando.length > 0 && (
                <View style={[styles.selo, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                  <Text style={[styles.seloTexto, { color: cores.red.padrao }]}>Falta: {faltando.join(', ')}</Text>
                </View>
              )}
            </View>
            {!expandida && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacamento.sm }}>
                <Text style={styles.resumoTitulo} numberOfLines={1}>
                  {resumo.titulo}
                </Text>
                <Text style={styles.resumoValor}>{resumo.valor}</Text>
              </View>
            )}
          </View>
          {estado !== 'descartada' &&
            (expandida ? (
              <ChevronUp size={16} color={cores.stone[400]} strokeWidth={2.4} />
            ) : (
              <ChevronDown size={16} color={cores.stone[400]} strokeWidth={2.4} />
            ))}
        </Pressable>

        {!linha.enviada && estado !== 'descartada' && (
          <Pressable style={styles.botaoDescartar} onPress={() => alternarDescarte(linha.id)} hitSlop={6}>
            <Trash2 size={13} color={cores.stone[600]} strokeWidth={2.4} />
            <Text style={styles.botaoDescartarTexto}>Descartar</Text>
          </Pressable>
        )}
        {estado === 'descartada' && (
          <Pressable style={styles.botaoDescartar} onPress={() => alternarDescarte(linha.id)} hitSlop={6}>
            <RotateCcw size={13} color={cores.stone[400]} strokeWidth={2.4} />
            <Text style={[styles.botaoDescartarTexto, { color: cores.stone[400] }]}>Restaurar</Text>
          </Pressable>
        )}

        {expandida && estado !== 'descartada' && <View style={{ gap: espacamento.md - 2 }}>{corpoLinha(linha)}</View>}

        {/* Card congelado em "revisão" (`secao`) mas já válido de verdade (`estado`) — pode
            acontecer se o congelamento ainda não liberou (folga do blur, ver `marcarEmEdicao`).
            Em vez de esperar o sócio adivinhar, este botão libera na hora. Fica no fim do card
            e com cor sólida — é a ação que fecha aquele lançamento. */}
        {expandida && estado === 'ok' && secao === 'revisar' && (
          <Pressable style={styles.botaoConfirmarPronto} onPress={() => marcarEmEdicao(linha.id, false)}>
            <CheckCircle2 size={15} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.botaoConfirmarProntoTexto}>Tudo certo aqui — toque para confirmar</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Revisão focada em tela cheia (atalho "Revisar pendentes agora") — anda pelos ids
  // "fotografados" no momento em que foi aberta (validade real, não a seção congelada), um card
  // por vez.
  const linhaFocada = revisaoFocada ? linhas.find((l) => l.id === revisaoFocada.ids[revisaoFocada.indice]) : undefined;
  const faltandoFocada = linhaFocada ? camposFaltando(linhaFocada, socios) : [];
  const podeAvancarFocada = !!linhaFocada && linhaValida(linhaFocada, socios);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
        <View style={styles.cabecalho}>
          <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
            <ArrowLeft size={18} color={cores.stone[900]} />
          </Pressable>
          <Text style={styles.tituloCabecalho}>Importar lançamentos</Text>
          <View style={styles.botaoVoltar} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.conteudo}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={etapa === 'revisao' ? styles.barraFixa : styles.barraFixaEscondida}>
            {etapa === 'revisao' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento.sm }}>
                  <View style={styles.barraFixaContador}>
                    <Text style={styles.barraFixaTexto}>
                      {contagemProntas} pronta{contagemProntas === 1 ? '' : 's'} · {contagemRevisar} precisa
                      {contagemRevisar === 1 ? '' : 'm'} de revisão · {linhasDescartadas.length} descartada
                      {linhasDescartadas.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Pressable style={styles.botaoAdicionar} onPress={adicionarLinhaManual}>
                    <Plus size={14} color="#FFFFFF" strokeWidth={2.6} />
                    <Text style={styles.botaoAdicionarTexto}>Adicionar</Text>
                  </Pressable>
                </View>
                {contagemRevisarReal > 0 && (
                  <Pressable style={styles.botaoRevisarPendentes} onPress={iniciarRevisaoFocada}>
                    <ListChecks size={15} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.botaoRevisarPendentesTexto}>
                      Revisar pendentes agora ({contagemRevisarReal})
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <View style={{ gap: espacamento.lg }}>
            {erro && <Text style={styles.erro}>{erro}</Text>}

            {etapa === 'upload' && (
              <>
                <Text style={styles.introducao}>
                  Envie foto(s) de página de caderno, PDF ou uma planilha com despesas e vendas dessa safra — a IA
                  vai sugerir os lançamentos, e você revisa e confirma cada um antes de salvar.
                </Text>

                {!conectado && (
                  <View style={styles.aviso}>
                    <AlertTriangle size={16} color={cores.amber.padrao} />
                    <Text style={styles.avisoTexto}>
                      A leitura por IA precisa de internet. Conecte-se pra continuar.
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: espacamento.sm }}>
                  <Pressable style={styles.botaoArquivo} onPress={tirarFoto} disabled={!conectado}>
                    <Camera size={22} color={cores.stone[700]} strokeWidth={1.8} />
                    <Text style={styles.botaoArquivoTexto}>Tirar foto</Text>
                  </Pressable>
                  <Pressable style={styles.botaoArquivo} onPress={escolherDaGaleria} disabled={!conectado}>
                    <Images size={22} color={cores.stone[700]} strokeWidth={1.8} />
                    <Text style={styles.botaoArquivoTexto}>Galeria</Text>
                  </Pressable>
                  <Pressable style={styles.botaoArquivo} onPress={escolherArquivo} disabled={!conectado}>
                    <FileText size={22} color={cores.stone[700]} strokeWidth={1.8} />
                    <Text style={styles.botaoArquivoTexto}>PDF/planilha</Text>
                  </Pressable>
                </View>

                {arquivos.length > 0 && (
                  <View style={{ gap: espacamento.xs + 2 }}>
                    {arquivos.map((arquivo, i) => (
                      <View key={`${arquivo.nome}-${i}`} style={styles.itemArquivo}>
                        <Text style={styles.itemArquivoTexto} numberOfLines={1}>
                          {arquivo.nome}
                        </Text>
                        <Pressable onPress={() => removerArquivo(i)} hitSlop={6} accessibilityLabel="Remover arquivo">
                          <X size={14} color={cores.red.padrao} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {etapa === 'revisao' && (
              <>
                <View style={styles.aviso}>
                  <Info size={16} color={cores.blue.padrao} />
                  <Text style={[styles.avisoTexto, { color: cores.blue.padrao }]}>
                    A IA pode deixar algum lançamento de fora, principalmente em letra difícil de ler. Confira cada
                    linha contra o original antes de confirmar — achou algo faltando? Use "Adicionar" acima.
                  </Text>
                </View>

                {arquivosSemLeitura.length > 0 && (
                  <View style={styles.aviso}>
                    <AlertTriangle size={16} color={cores.amber.padrao} />
                    <Text style={styles.avisoTexto}>
                      Não conseguimos identificar nenhum lançamento em {arquivosSemLeitura.length} arquivo
                      {arquivosSemLeitura.length === 1 ? '' : 's'}. Considere tirar a foto de novo se esperava
                      encontrar algo ali.
                    </Text>
                  </View>
                )}

                {linhas.length === 0 && <Text style={styles.semLinhas}>Nenhum lançamento identificado.</Text>}

                {linhasPendentes.length > 0 && (
                  <View style={{ gap: espacamento.sm + 2 }}>
                    <Text style={[styles.tituloSecao, { color: cores.red.padrao }]}>
                      PRECISAM DE REVISÃO ({linhasPendentes.length})
                    </Text>
                    {linhasPendentes.map((linha) => renderCard(linha, 'revisar'))}
                  </View>
                )}

                {linhasProntas.length > 0 && (
                  <View style={{ gap: espacamento.sm + 2 }}>
                    <Text style={[styles.tituloSecao, { color: cores.green[700] }]}>
                      PRONTAS PARA IMPORTAR ({linhasProntas.length})
                    </Text>
                    {linhasProntas.map((linha) => renderCard(linha, 'ok'))}
                  </View>
                )}

                {linhasDescartadas.length > 0 && (
                  <View style={{ gap: espacamento.sm + 2 }}>
                    <Text style={[styles.tituloSecao, { color: cores.stone[400] }]}>
                      DESCARTADAS ({linhasDescartadas.length})
                    </Text>
                    {linhasDescartadas.map((linha) => renderCard(linha, 'descartada'))}
                  </View>
                )}
              </>
            )}

            {etapa === 'resumo' && (
              <View style={styles.resumoContainer}>
                <CheckCircle2 size={48} color={cores.green[700]} strokeWidth={1.6} />
                <Text style={styles.resumoTituloFinal}>Importação concluída</Text>
                <Text style={styles.resumoTexto}>
                  {totalEnviadasDespesa} despesa{totalEnviadasDespesa === 1 ? '' : 's'} e {totalEnviadasVenda} venda
                  {totalEnviadasVenda === 1 ? '' : 's'} importadas
                </Text>
                <Pressable style={styles.botaoVoltarLista} onPress={() => navigation.goBack()}>
                  <Text style={styles.botaoVoltarListaTexto}>Voltar</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>

        {etapa !== 'resumo' && (
          <View style={styles.rodape}>
            <Pressable
              style={[
                styles.botaoPrimario,
                (etapa === 'upload' ? arquivos.length === 0 || analisando || !conectado : contagemProntas === 0 || confirmando) &&
                  styles.botaoDesabilitado,
              ]}
              onPress={etapa === 'upload' ? analisar : confirmarImportacao}
              disabled={etapa === 'upload' ? arquivos.length === 0 || analisando || !conectado : contagemProntas === 0 || confirmando}
            >
              {analisando || confirmando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Sparkles size={16} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.textoBotaoPrimario}>
                    {etapa === 'upload' ? 'Analisar com IA' : `Importar ${contagemProntas} lançamento${contagemProntas === 1 ? '' : 's'}`}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </TelaComTeclado>

      <Modal visible={!!revisaoFocada} animationType="slide" onRequestClose={() => setRevisaoFocada(null)}>
        <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
          {revisaoFocada && (
            <View style={{ flex: 1 }}>
              <View style={styles.cabecalhoFocado}>
                <View style={styles.cabecalhoFocadoTopo}>
                  <Pressable style={styles.botaoVoltar} onPress={() => setRevisaoFocada(null)} hitSlop={8}>
                    <X size={18} color={cores.stone[900]} />
                  </Pressable>
                  <Text style={styles.tituloCabecalho}>Revisão rápida</Text>
                  <View style={styles.botaoVoltar} />
                </View>
                <View style={styles.barraProgresso}>
                  <View
                    style={[
                      styles.barraProgressoFill,
                      { width: `${((revisaoFocada.indice + 1) / revisaoFocada.ids.length) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressoLegenda}>
                  Lançamento {revisaoFocada.indice + 1} de {revisaoFocada.ids.length}
                </Text>
              </View>

              <ScrollView contentContainerStyle={styles.conteudoFocado} keyboardShouldPersistTaps="handled">
                {linhaFocada ? (
                  <View style={[styles.card, styles.cardRevisar, { marginTop: espacamento.md }]}>
                    <View style={styles.cardTopo}>
                      <View style={[styles.selo, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                        <Text style={[styles.seloTexto, { color: cores.red.padrao }]}>
                          Falta: {faltandoFocada.join(', ') || 'confira os campos'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: espacamento.md - 2 }}>{corpoLinha(linhaFocada)}</View>
                  </View>
                ) : (
                  <Text style={styles.semLinhas}>Este lançamento não está mais disponível.</Text>
                )}
              </ScrollView>

              <View style={styles.rodape}>
                <View style={{ flexDirection: 'row', gap: espacamento.sm + 2 }}>
                  {revisaoFocada.indice > 0 && (
                    <Pressable style={styles.botaoAnteriorFocado} onPress={voltarRevisaoFocada} hitSlop={8}>
                      <ChevronLeft size={20} color={cores.stone[700]} strokeWidth={2.4} />
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.botaoDescartarFocado}
                    onPress={() => {
                      if (linhaFocada) alternarDescarte(linhaFocada.id);
                      avancarRevisaoFocada();
                    }}
                  >
                    <Text style={styles.botaoDescartarFocadoTexto}>Descartar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.botaoAvancarFocado, !podeAvancarFocada && styles.botaoDesabilitado]}
                    disabled={!podeAvancarFocada}
                    onPress={avancarRevisaoFocada}
                  >
                    <Text style={styles.textoBotaoPrimario}>Confirmar e avançar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.cream[50] },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacamento.lg,
    paddingTop: espacamento.sm,
    paddingBottom: espacamento.xs,
  },
  botaoVoltar: {
    width: 38,
    height: 38,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloCabecalho: { fontSize: 17, fontWeight: '800', color: cores.stone[900] },
  conteudo: { paddingHorizontal: espacamento.xl, paddingBottom: espacamento.xl },
  barraFixaEscondida: { height: 0 },
  barraFixa: {
    gap: espacamento.sm,
    backgroundColor: cores.cream[50],
    paddingVertical: espacamento.sm + 2,
  },
  barraFixaContador: { flex: 1, backgroundColor: cores.cream[100], borderRadius: raio.lg, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm + 2 },
  barraFixaTexto: { fontSize: 11, fontWeight: '700', color: cores.stone[700] },
  botaoAdicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs,
    backgroundColor: cores.green[800],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm + 2,
  },
  botaoAdicionarTexto: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },
  botaoRevisarPendentes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xs + 2,
    backgroundColor: cores.green[900],
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 2,
  },
  botaoRevisarPendentesTexto: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
  erro: { color: cores.red.padrao, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  introducao: { fontSize: 13, lineHeight: 18, color: cores.stone[600] },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  avisoTexto: { flex: 1, fontSize: 11.5, color: cores.amber.padrao, lineHeight: 16 },
  botaoArquivo: {
    flex: 1,
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg,
  },
  botaoArquivoTexto: { fontSize: 11, fontWeight: '700', color: cores.stone[700], textAlign: 'center' },
  itemArquivo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: cores.cream[100],
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
  },
  itemArquivoTexto: { flex: 1, fontSize: 12, fontWeight: '500', color: cores.stone[700], marginRight: espacamento.sm },
  semLinhas: { textAlign: 'center', fontSize: 13, color: cores.stone[600] },
  tituloSecao: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  card: { gap: espacamento.md - 2, borderWidth: 1.5, borderRadius: raio.lg, padding: espacamento.md + 2 },
  cardOk: { borderColor: cores.green[600], backgroundColor: cores.green[100] },
  cardRevisar: { borderColor: cores.red.padrao, backgroundColor: cores.red.fundo },
  cardDescartado: { borderColor: cores.linha, backgroundColor: cores.cream[100], opacity: 0.6 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espacamento.xs + 2 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: raio.pill, paddingHorizontal: espacamento.sm, paddingVertical: 2 },
  seloTexto: { fontSize: 10, fontWeight: '700' },
  resumoTitulo: { flex: 1, fontSize: 13, fontWeight: '700', color: cores.stone[900] },
  resumoValor: { fontSize: 12.5, fontWeight: '700', color: cores.stone[700] },
  botaoDescartar: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: -espacamento.xs },
  botaoDescartarTexto: { fontSize: 11, fontWeight: '700', color: cores.stone[600] },
  botaoConfirmarPronto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xs + 2,
    backgroundColor: cores.green[800],
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 3,
  },
  botaoConfirmarProntoTexto: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  tipoBotao: { flex: 1, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingVertical: espacamento.sm, alignItems: 'center', backgroundColor: '#FFFFFF' },
  tipoBotaoAtivo: { borderColor: cores.green[800], backgroundColor: cores.green[800] },
  tipoBotaoTexto: { fontSize: 12, fontWeight: '700', color: cores.stone[700] },
  tipoBotaoTextoAtivo: { color: '#FFFFFF' },
  label: { fontSize: 11, fontWeight: '700', color: cores.green[700], marginBottom: espacamento.xs + 2 },
  campoErro: { fontSize: 10.5, color: cores.red.padrao, marginTop: espacamento.xs },
  linhaChips: { flexDirection: 'row', gap: espacamento.sm },
  chip: { borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.pill, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm - 1, backgroundColor: '#FFFFFF' },
  chipAtivo: { borderColor: cores.green[800], backgroundColor: cores.green[800] },
  chipTexto: { fontSize: 12, fontWeight: '700', color: cores.stone[700] },
  chipTextoAtivo: { color: '#FFFFFF' },
  rateioBotao: { flex: 1, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingVertical: espacamento.sm, alignItems: 'center', backgroundColor: '#FFFFFF' },
  rateioBotaoAtivo: { borderColor: cores.green[700], backgroundColor: cores.green[100] },
  rateioBotaoTexto: { fontSize: 10.5, fontWeight: '700', color: cores.stone[700] },
  rateioBotaoTextoAtivo: { color: cores.green[800] },
  blocoRateio: { marginTop: espacamento.sm, gap: espacamento.xs + 2, borderWidth: 1.5, borderColor: cores.green[100], borderRadius: raio.md, padding: espacamento.sm + 2, backgroundColor: '#FFFFFF' },
  linhaPercentual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacamento.sm },
  linhaPercentualNome: { flex: 1, fontSize: 12, fontWeight: '600', color: cores.stone[700] },
  inputPercentual: { width: 44, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.sm, textAlign: 'center', paddingVertical: 4, fontSize: 12, fontWeight: '700', color: cores.stone[900] },
  percentualSinal: { fontSize: 12, fontWeight: '700', color: cores.stone[600] },
  valorLinha: { flexDirection: 'row', alignItems: 'baseline', gap: espacamento.xs + 2, borderBottomWidth: 2, borderBottomColor: cores.linha, paddingVertical: espacamento.sm },
  valorPrefixo: { fontSize: 18, fontWeight: '700', color: cores.stone[400] },
  valorInput: { minWidth: 120, fontSize: 26, fontWeight: '800', color: cores.stone[900], padding: 0 },
  valorLinhaPequena: { flexDirection: 'row', alignItems: 'center', gap: espacamento.xs, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.sm + 2, paddingVertical: espacamento.sm, backgroundColor: '#FFFFFF' },
  valorPrefixoPequeno: { fontSize: 12, fontWeight: '700', color: cores.stone[600] },
  valorInputPequeno: { flex: 1, fontSize: 12.5, fontWeight: '700', color: cores.stone[900], padding: 0 },
  totalLinha: { fontSize: 12, color: cores.stone[600] },
  input: { borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm + 2, fontSize: 12.5, fontWeight: '500', color: cores.stone[900], backgroundColor: '#FFFFFF' },
  botaoCriarUnidade: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: espacamento.md, borderRadius: raio.md, backgroundColor: cores.green[800] },
  botaoCriarUnidadeTexto: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  linhaToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm, backgroundColor: '#FFFFFF' },
  toggleTitulo: { flex: 1, fontSize: 12, fontWeight: '600', color: cores.stone[700] },
  resumoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacamento.sm, paddingVertical: espacamento.xxl },
  resumoTituloFinal: { fontSize: 15, fontWeight: '800', color: cores.stone[900] },
  resumoTexto: { fontSize: 13, color: cores.stone[600] },
  botaoVoltarLista: { marginTop: espacamento.sm, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.lg, paddingVertical: espacamento.sm + 2 },
  botaoVoltarListaTexto: { fontSize: 12.5, fontWeight: '700', color: cores.stone[700] },
  rodape: { borderTopWidth: 1, borderTopColor: cores.cream[100], paddingHorizontal: espacamento.xl, paddingVertical: espacamento.md },
  botaoPrimario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacamento.sm, borderRadius: raio.lg, paddingVertical: espacamento.lg - 2, backgroundColor: cores.green[800] },
  botaoDesabilitado: { opacity: 0.5 },
  textoBotaoPrimario: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cabecalhoFocado: { paddingHorizontal: espacamento.lg, paddingTop: espacamento.sm, paddingBottom: espacamento.md, borderBottomWidth: 1, borderBottomColor: cores.cream[100], gap: espacamento.sm },
  cabecalhoFocadoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barraProgresso: { height: 6, borderRadius: raio.pill, backgroundColor: cores.cream[100], overflow: 'hidden' },
  barraProgressoFill: { height: '100%', borderRadius: raio.pill, backgroundColor: cores.green[800] },
  progressoLegenda: { fontSize: 11.5, fontWeight: '700', color: cores.stone[600] },
  conteudoFocado: { paddingHorizontal: espacamento.xl, paddingBottom: espacamento.xl },
  botaoAnteriorFocado: { width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: raio.lg, borderWidth: 1.5, borderColor: cores.linha },
  botaoDescartarFocado: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: raio.lg, borderWidth: 1.5, borderColor: cores.red.padrao, paddingVertical: espacamento.lg - 4 },
  botaoDescartarFocadoTexto: { fontSize: 13, fontWeight: '700', color: cores.red.padrao },
  botaoAvancarFocado: { flex: 1.4, alignItems: 'center', justifyContent: 'center', borderRadius: raio.lg, backgroundColor: cores.green[800], paddingVertical: espacamento.lg - 4 },
});
