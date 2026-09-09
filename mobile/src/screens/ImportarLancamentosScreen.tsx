import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
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

function rateioParaEnviar(l: LinhaEditavel, socios: Socio[]): { socio_id: string; percentual: number }[] | undefined {
  if (l.modoRateio === 'padrao') return undefined;
  if (l.modoRateio === 'exclusivo') return l.rateioExclusivoId ? [{ socio_id: l.rateioExclusivoId, percentual: 100 }] : undefined;
  return socios
    .map((s) => ({ socio_id: s.id, percentual: Number(l.rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
    .filter((r) => r.percentual > 0);
}

type Etapa = 'upload' | 'revisao' | 'resumo';

// Tela de importação por IA (docs/specs/mobile/12-importacao-por-ia.md), equivalente à
// frontend/src/pages/ImportarLancamentosPage.tsx do web. A extração exige internet (chamada à
// API do Gemini) — sem conexão, o botão "Analisar" fica desabilitado com aviso explícito, em
// vez de tentar enfileirar algo que não existe ainda. Depois de extraído, a confirmação de cada
// linha reaproveita `criarDespesa`/`criarVenda` da fila offline já existente — nunca falha por
// falta de rede, então (diferente do web) não precisa de lógica própria de retry parcial.
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

  function adicionarLinhaManual() {
    setLinhas((atual) => [novaLinhaManual(usuario?.id ?? null, sociosComConta, socios), ...atual]);
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
  const contagemProntas = linhasAtivas.filter((l) => !l.enviada && linhaValida(l, socios)).length;
  const contagemRevisar = linhasAtivas.filter((l) => !l.enviada && !linhaValida(l, socios)).length;
  const contagemDescartadas = linhas.length - linhasAtivas.length;

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
                <View style={styles.barraFixaContador}>
                  <Text style={styles.barraFixaTexto}>
                    {contagemProntas} pronta{contagemProntas === 1 ? '' : 's'} · {contagemRevisar} precisa
                    {contagemRevisar === 1 ? '' : 'm'} de revisão · {contagemDescartadas} descartada
                    {contagemDescartadas === 1 ? '' : 's'}
                  </Text>
                </View>
                <Pressable style={styles.botaoAdicionar} onPress={adicionarLinhaManual}>
                  <Plus size={14} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={styles.botaoAdicionarTexto}>Adicionar</Text>
                </Pressable>
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

                {linhas.map((linha) => {
                  const valida = linhaValida(linha, socios);
                  return (
                    <View
                      key={linha.id}
                      style={[
                        styles.card,
                        linha.descartada ? styles.cardDescartado : valida ? styles.cardOk : styles.cardRevisar,
                      ]}
                    >
                      <View style={styles.cardTopo}>
                        {linha.manual ? (
                          <View style={[styles.selo, { backgroundColor: cores.blue.fundo }]}>
                            <PenLine size={11} color={cores.blue.padrao} strokeWidth={2.6} />
                            <Text style={[styles.seloTexto, { color: cores.blue.padrao }]}>Adicionado por você</Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.selo,
                              { backgroundColor: linha.confianca === 'ALTA' ? cores.green[100] : cores.amber.fundo },
                            ]}
                          >
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
                          <View style={[styles.selo, { backgroundColor: cores.green[100] }]}>
                            <CheckCircle2 size={11} color={cores.green[800]} strokeWidth={2.6} />
                            <Text style={[styles.seloTexto, { color: cores.green[800] }]}>Importado</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }} />
                        {!linha.enviada && (
                          <Pressable style={styles.botaoDescartar} onPress={() => alternarDescarte(linha.id)} hitSlop={6}>
                            {linha.descartada ? (
                              <RotateCcw size={13} color={cores.stone[400]} strokeWidth={2.4} />
                            ) : (
                              <Trash2 size={13} color={cores.stone[400]} strokeWidth={2.4} />
                            )}
                            <Text style={styles.botaoDescartarTexto}>{linha.descartada ? 'Restaurar' : 'Descartar'}</Text>
                          </Pressable>
                        )}
                      </View>

                      {!linha.descartada && (
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
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {etapa === 'resumo' && (
              <View style={styles.resumoContainer}>
                <CheckCircle2 size={48} color={cores.green[700]} strokeWidth={1.6} />
                <Text style={styles.resumoTitulo}>Importação concluída</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
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
  card: { gap: espacamento.md - 2, borderWidth: 1.5, borderRadius: raio.lg, padding: espacamento.md + 2 },
  cardOk: { borderColor: cores.linha, backgroundColor: '#FFFFFF' },
  cardRevisar: { borderColor: cores.amber.fundo, backgroundColor: '#fffaf1' },
  cardDescartado: { borderColor: cores.linha, backgroundColor: cores.cream[100], opacity: 0.6 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: espacamento.xs + 2 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: raio.pill, paddingHorizontal: espacamento.sm, paddingVertical: 2 },
  seloTexto: { fontSize: 10, fontWeight: '700' },
  botaoDescartar: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  botaoDescartarTexto: { fontSize: 11, fontWeight: '700', color: cores.stone[400] },
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
  blocoRateio: { marginTop: espacamento.sm, gap: espacamento.xs + 2, borderWidth: 1.5, borderColor: cores.green[100], borderRadius: raio.md, padding: espacamento.sm + 2 },
  linhaPercentual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacamento.sm },
  linhaPercentualNome: { flex: 1, fontSize: 12, fontWeight: '600', color: cores.stone[700] },
  inputPercentual: { width: 44, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.sm, textAlign: 'center', paddingVertical: 4, fontSize: 12, fontWeight: '700', color: cores.stone[900] },
  percentualSinal: { fontSize: 12, fontWeight: '700', color: cores.stone[600] },
  valorLinha: { flexDirection: 'row', alignItems: 'baseline', gap: espacamento.xs + 2, borderBottomWidth: 2, borderBottomColor: cores.linha, paddingVertical: espacamento.sm },
  valorPrefixo: { fontSize: 18, fontWeight: '700', color: cores.stone[400] },
  valorInput: { minWidth: 120, fontSize: 26, fontWeight: '800', color: cores.stone[900], padding: 0 },
  valorLinhaPequena: { flexDirection: 'row', alignItems: 'center', gap: espacamento.xs, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.sm + 2, paddingVertical: espacamento.sm },
  valorPrefixoPequeno: { fontSize: 12, fontWeight: '700', color: cores.stone[600] },
  valorInputPequeno: { flex: 1, fontSize: 12.5, fontWeight: '700', color: cores.stone[900], padding: 0 },
  totalLinha: { fontSize: 12, color: cores.stone[600] },
  input: { borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm + 2, fontSize: 12.5, fontWeight: '500', color: cores.stone[900], backgroundColor: '#FFFFFF' },
  botaoCriarUnidade: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: espacamento.md, borderRadius: raio.md, backgroundColor: cores.green[800] },
  botaoCriarUnidadeTexto: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  linhaToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm },
  toggleTitulo: { flex: 1, fontSize: 12, fontWeight: '600', color: cores.stone[700] },
  resumoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacamento.sm, paddingVertical: espacamento.xxl },
  resumoTitulo: { fontSize: 15, fontWeight: '800', color: cores.stone[900] },
  resumoTexto: { fontSize: 13, color: cores.stone[600] },
  botaoVoltarLista: { marginTop: espacamento.sm, borderWidth: 1.5, borderColor: cores.linha, borderRadius: raio.md, paddingHorizontal: espacamento.lg, paddingVertical: espacamento.sm + 2 },
  botaoVoltarListaTexto: { fontSize: 12.5, fontWeight: '700', color: cores.stone[700] },
  rodape: { borderTopWidth: 1, borderTopColor: cores.cream[100], paddingHorizontal: espacamento.xl, paddingVertical: espacamento.md },
  botaoPrimario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacamento.sm, borderRadius: raio.lg, paddingVertical: espacamento.lg - 2, backgroundColor: cores.green[800] },
  botaoDesabilitado: { opacity: 0.5 },
  textoBotaoPrimario: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
