import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, ArrowLeft, Camera, Check, Clock, Percent, SlidersHorizontal, Trash2, User, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { obterSociosCache } from '../lib/sociedadesCache';
import { listarSociosRequest } from '../services/sociedades';
import { useConectividade } from '../lib/useConectividade';
import { criarDespesa, editarDespesa, excluirDespesa } from '../lib/despesasQueue';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { hojeISO } from '../lib/data';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { DateSelectorChip } from '../components/DateSelectorChip';
import { cores, espacamento, raio } from '../theme';
import type { StatusPagamento, TipoDespesa } from '../types/despesa';
import type { Socio } from '../types/sociedade';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NovaDespesa'>;

type ModoRateio = 'padrao' | 'exclusivo' | 'personalizado';
type SituacaoPagamento = 'pago' | 'pendente' | 'parcelado';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

// Soma `meses` a uma data ISO (YYYY-MM-DD) — mesma lógica de
// frontend/src/pages/NovaDespesaPage.tsx (web), docs/specs/19-despesa-pendente-e-parcelamento.md.
function adicionarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Divide o valor total (em centavos) em `n` parcelas o mais iguais possível, com a última
// absorvendo a diferença de arredondamento — mesma regra do web (docs/specs/19).
function splitParcelas(totalCentavos: number, n: number): number[] {
  const base = Math.round(totalCentavos / n);
  const parcelas = Array(n - 1).fill(base);
  parcelas.push(totalCentavos - base * (n - 1));
  return parcelas;
}

// Divide 100% em `n` fatias, todas múltiplas de 5, o mais igual possível — ponto de partida
// do rateio personalizado, pra fechar em 100% usando só os botões de +5/-5 (bug relatado
// 2026-08-27, mesmo ajuste do web).
function splitPercentuaisMultiplosDe5(n: number): number[] {
  const totalFatias = 20; // 100% ÷ 5
  const base = Math.floor(totalFatias / n);
  const resto = totalFatias - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) * 5);
}

// Máscara "estilo Pix": o produtor só digita números, o valor se monta da direita pra
// esquerda — mesma lógica de frontend/src/pages/NovaDespesaPage.tsx (web).
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

// Tela de criação/edição de despesa da sociedade — equivalente à
// frontend/src/pages/NovaDespesaPage.tsx do web, incluindo o mesmo seletor de rateio
// (docs/specs/13-rateio-de-despesas.md). Diferente do web, sempre escreve através do cache
// local + fila de sincronização (mobile/src/lib/despesasQueue.ts): funciona sem internet por
// padrão, não como um caminho alternativo (docs/specs/mobile/04-despesas-da-sociedade.md).
export function NovaDespesaScreen({ navigation, route }: Props) {
  const { safraId, sociedadeId, despesa } = route.params;
  const emEdicao = !!despesa;
  const { usuario } = useAuth();
  const conectado = useConectividade();

  const [socios, setSocios] = useState<Socio[]>([]);
  const [carregandoSocios, setCarregandoSocios] = useState(true);
  const [socioId, setSocioId] = useState(despesa?.socio_id ?? '');
  const [tipo, setTipo] = useState<TipoDespesa>(despesa?.tipo ?? 'OUTRO');

  const rateioInicial = despesa?.rateio ?? null;
  const [modoRateio, setModoRateio] = useState<ModoRateio>(
    !rateioInicial ? 'padrao' : rateioInicial.length === 1 ? 'exclusivo' : 'personalizado'
  );
  const [rateioExclusivoId, setRateioExclusivoId] = useState(
    rateioInicial && rateioInicial.length === 1 ? rateioInicial[0].socio_id : ''
  );
  const [rateioPercentuais, setRateioPercentuais] = useState<Record<string, string>>(
    rateioInicial && rateioInicial.length > 1
      ? Object.fromEntries(rateioInicial.map((r) => [r.socio_id, String(r.percentual)]))
      : {}
  );

  const [descricao, setDescricao] = useState(despesa?.descricao ?? '');
  const [valorCentavos, setValorCentavos] = useState(
    despesa ? String(Math.round(Number(despesa.valor) * 100)) : ''
  );
  const [data, setData] = useState(despesa?.data.slice(0, 10) ?? hojeISO());
  const [foto, setFoto] = useState<string | null>(despesa?.foto_comprovante ?? null);

  // docs/specs/19-despesa-pendente-e-parcelamento.md
  const [situacao, setSituacao] = useState<SituacaoPagamento>(
    despesa?.status_pagamento === 'PENDENTE' ? 'pendente' : 'pago'
  );
  const [dataVencimento, setDataVencimento] = useState(despesa?.data_vencimento?.slice(0, 10) ?? hojeISO());
  const [numParcelas, setNumParcelas] = useState(2);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  // Guarda síncrona contra duplo toque em "Salvar despesa": `salvando` (estado) só desabilita
  // o botão depois que o React re-renderiza, e um toque duplo rápido consegue disparar
  // `salvar()` duas vezes nesse intervalo — cada chamada criando uma despesa própria. Um ref
  // muda na hora, sem esperar render, e é o que realmente bloqueia a segunda chamada.
  const salvandoRef = useRef(false);

  const travadaPorAcerto = despesa?.coberta_por_acerto ?? false;

  useEffect(() => {
    (async () => {
      const cache = await obterSociosCache(sociedadeId);
      if (cache.length > 0) {
        setSocios(cache);
        if (!emEdicao) {
          const primeiroComConta = cache.find((s) => s.usuario_id);
          if (primeiroComConta) setSocioId(primeiroComConta.usuario_id!);
        }
        if (!emEdicao && rateioExclusivoId === '' && cache.length > 0) setRateioExclusivoId(cache[0].id);
        setCarregandoSocios(false);
      }

      try {
        const { socios: atualizados } = await listarSociosRequest(sociedadeId);
        setSocios(atualizados);
        if (!emEdicao && !socioId) {
          const primeiroComConta = atualizados.find((s) => s.usuario_id);
          if (primeiroComConta) setSocioId(primeiroComConta.usuario_id!);
        }
      } catch {
        // offline: segue só com o que já estava em cache (ou vazio, tratado abaixo)
      } finally {
        setCarregandoSocios(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId]);

  const sociosComConta = socios.filter((s) => s.usuario_id);

  function selecionarPersonalizado() {
    setModoRateio('personalizado');
    if (Object.keys(rateioPercentuais).length === 0 && socios.length > 0) {
      const fatias = splitPercentuaisMultiplosDe5(socios.length);
      setRateioPercentuais(Object.fromEntries(socios.map((s, i) => [s.id, String(fatias[i])])));
    }
  }

  function ajustarPercentual(id: string, delta: number) {
    setRateioPercentuais((atual) => {
      const valorAtual = Number(atual[id]?.replace(',', '.')) || 0;
      const novoValor = Math.min(100, Math.max(0, valorAtual + delta));
      return { ...atual, [id]: String(novoValor) };
    });
  }

  const somaRateioPersonalizado = socios.reduce(
    (acc, s) => acc + (Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0),
    0
  );
  const rateioValido =
    modoRateio === 'padrao' ||
    (modoRateio === 'exclusivo' && !!rateioExclusivoId) ||
    (modoRateio === 'personalizado' && Math.abs(somaRateioPersonalizado - 100) <= 0.01);

  function alterarValor(texto: string) {
    setValorCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para anexar um comprovante.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });
    if (resultado.canceled || !resultado.assets?.[0]?.base64) return;
    setFoto(`data:image/jpeg;base64,${resultado.assets[0].base64}`);
  }

  const formValido = !!socioId && valorCentavos !== '' && valorNumero > 0 && !!data && rateioValido;

  function rateioParaEnviar(): { socio_id: string; percentual: number }[] | undefined {
    if (modoRateio === 'padrao') return undefined;
    if (modoRateio === 'exclusivo') return [{ socio_id: rateioExclusivoId, percentual: 100 }];
    return socios
      .map((s) => ({ socio_id: s.id, percentual: Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
      .filter((r) => r.percentual > 0);
  }

  async function salvar() {
    if (!formValido || salvandoRef.current) return;
    salvandoRef.current = true;
    setErro(null);
    setSalvando(true);
    try {
      const socioNome = sociosComConta.find((s) => s.usuario_id === socioId)?.nome ?? '';
      const todosSocios = socios.map((s) => ({ id: s.id, nome: s.nome }));

      if (situacao === 'parcelado' && !emEdicao) {
        await salvarParcelado(socioNome, todosSocios);
        navigation.goBack();
        return;
      }

      const input = {
        socio_id: socioId,
        tipo,
        valor: valorNumero,
        data,
        foto_comprovante: foto ?? undefined,
        descricao: descricao.trim() || undefined,
        rateio: rateioParaEnviar(),
        status_pagamento: (situacao === 'pendente' ? 'PENDENTE' : 'PAGO') as StatusPagamento,
        data_vencimento: situacao === 'pendente' ? dataVencimento : undefined,
      };

      if (emEdicao && despesa) {
        await editarDespesa(safraId, despesa, input, socioNome, todosSocios);
      } else {
        await criarDespesa(safraId, input, socioNome, todosSocios);
      }
      navigation.goBack();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a despesa');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  // Cria N despesas independentes, uma por parcela (mesma decisão do web: sem endpoint novo
  // no backend, docs/specs/19). Diferente do web, `criarDespesa` (fila offline-first) nunca
  // lança por falha de rede — grava local na hora e só tenta enviar se houver conexão — então
  // não precisa da lógica de retry parcial que o formulário web tem.
  async function salvarParcelado(socioNome: string, todosSocios: { id: string; nome: string }[]) {
    const totalCentavos = Number(valorCentavos);
    const valoresCentavos = splitParcelas(totalCentavos, numParcelas);
    const totalFormatado = formatarMoeda(valorNumero);

    for (let i = 0; i < numParcelas; i++) {
      const descricaoParcela = `${descricao.trim() ? `${descricao.trim()} — ` : ''}parcela ${i + 1}/${numParcelas} de ${totalFormatado}`;
      const dataDaParcela = adicionarMeses(dataVencimento, i);
      await criarDespesa(
        safraId,
        {
          socio_id: socioId,
          tipo,
          valor: valoresCentavos[i] / 100,
          data: dataDaParcela,
          foto_comprovante: foto ?? undefined,
          descricao: descricaoParcela,
          rateio: rateioParaEnviar(),
          status_pagamento: 'PENDENTE',
          data_vencimento: dataDaParcela,
        },
        socioNome,
        todosSocios
      );
    }
  }

  async function excluir() {
    if (!despesa) return;
    Alert.alert('Excluir despesa?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setExcluindo(true);
          try {
            await excluirDespesa(safraId, despesa);
            navigation.goBack();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Não foi possível excluir a despesa');
            setExcluindo(false);
          }
        },
      },
    ]);
  }

  const semSociosEmCache = !carregandoSocios && sociosComConta.length === 0;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>{emEdicao ? 'Editar despesa' : 'Nova despesa'}</Text>
        {emEdicao ? (
          <Pressable
            style={styles.botaoVoltar}
            onPress={excluir}
            disabled={excluindo || travadaPorAcerto}
            hitSlop={8}
            accessibilityLabel="Excluir despesa"
          >
            <Trash2 size={17} color={travadaPorAcerto ? cores.stone[400] : cores.red.padrao} />
          </Pressable>
        ) : (
          <View style={styles.botaoVoltar} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {travadaPorAcerto && (
          <View style={styles.aviso}>
            <AlertTriangle size={16} color={cores.amber.padrao} />
            <Text style={styles.avisoTexto}>
              Essa despesa já faz parte de um acerto registrado, então não pode mais ser editada ou excluída.
            </Text>
          </View>
        )}

        {carregandoSocios && sociosComConta.length === 0 && <ActivityIndicator />}

        {semSociosEmCache && (
          <View style={styles.aviso}>
            <AlertTriangle size={16} color={cores.amber.padrao} />
            <Text style={styles.avisoTexto}>
              {conectado
                ? 'Não foi possível carregar os sócios da sociedade.'
                : 'Nenhum sócio salvo neste aparelho ainda — conecte-se à internet pelo menos uma vez antes de lançar despesas.'}
            </Text>
          </View>
        )}

        {!semSociosEmCache && !travadaPorAcerto && (
          <>
            {situacao !== 'parcelado' && (
              <View>
                <Text style={styles.label}>Data</Text>
                <DateSelectorChip value={data} onChange={setData} />
              </View>
            )}

            <View>
              <Text style={styles.label}>Quem bancou?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.linhaChips}>
                  {sociosComConta.map((s) => {
                    const ativo = s.usuario_id === socioId;
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, ativo && styles.chipAtivo]}
                        onPress={() => setSocioId(s.usuario_id!)}
                      >
                        <View style={[styles.avatarChip, ativo && styles.avatarChipAtivo]}>
                          <Text style={[styles.avatarChipTexto, ativo && styles.avatarChipTextoAtivo]}>
                            {iniciais(s.nome)}
                          </Text>
                        </View>
                        <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                          {s.nome}
                          {s.usuario_id === usuario?.id ? ' (Você)' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>Quem paga essa despesa?</Text>
              <View style={{ gap: espacamento.sm }}>
                {(
                  [
                    { modo: 'padrao' as const, titulo: 'Dividir como o lucro', sub: 'Mesmo percentual combinado entre os sócios', Icone: Percent },
                    { modo: 'exclusivo' as const, titulo: 'Só de um sócio', sub: 'Um único sócio arca com 100% dessa despesa', Icone: User },
                    { modo: 'personalizado' as const, titulo: 'Personalizado', sub: 'Você define o percentual de cada sócio', Icone: SlidersHorizontal },
                  ]
                ).map(({ modo, titulo, sub, Icone }) => {
                  const ativo = modoRateio === modo;
                  return (
                    <Pressable
                      key={modo}
                      style={[styles.opcaoRateio, ativo && styles.opcaoRateioAtiva]}
                      onPress={() => (modo === 'personalizado' ? selecionarPersonalizado() : setModoRateio(modo))}
                    >
                      <View style={[styles.opcaoRateioIcone, ativo && styles.opcaoRateioIconeAtivo]}>
                        <Icone size={16} color={ativo ? cores.green[700] : cores.stone[600]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.opcaoRateioTitulo}>{titulo}</Text>
                        <Text style={styles.opcaoRateioSub}>{sub}</Text>
                      </View>
                      <View style={[styles.radio, ativo && styles.radioAtivo]}>
                        {ativo && <View style={styles.radioPonto} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {modoRateio === 'exclusivo' && (
                <View style={styles.blocoRateio}>
                  <Text style={styles.blocoRateioLabel}>Escolha quem paga:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.linhaChips}>
                      {socios.map((s) => {
                        const ativo = s.id === rateioExclusivoId;
                        return (
                          <Pressable
                            key={s.id}
                            style={[styles.chip, ativo && styles.chipAtivo]}
                            onPress={() => setRateioExclusivoId(s.id)}
                          >
                            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                              {s.nome}
                              {s.usuario_id === usuario?.id ? ' (Você)' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {modoRateio === 'personalizado' && (
                <View style={styles.blocoRateio}>
                  <View
                    style={[
                      styles.badgeSoma,
                      Math.abs(somaRateioPersonalizado - 100) <= 0.01 ? styles.badgeSomaOk : styles.badgeSomaErro,
                    ]}
                  >
                    {Math.abs(somaRateioPersonalizado - 100) <= 0.01 && <Check size={12} color={cores.green[700]} />}
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: Math.abs(somaRateioPersonalizado - 100) <= 0.01 ? cores.green[700] : cores.red.padrao,
                      }}
                    >
                      Total: {somaRateioPersonalizado.toFixed(0)}%
                      {Math.abs(somaRateioPersonalizado - 100) > 0.01 ? ' (precisa fechar em 100%)' : ''}
                    </Text>
                  </View>

                  {socios.map((s) => {
                    const valor = Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0;
                    return (
                      <View key={s.id} style={styles.linhaPercentual}>
                        <Text style={styles.linhaPercentualNome} numberOfLines={1}>
                          {s.nome}
                          {s.usuario_id === usuario?.id ? ' (Você)' : ''}
                        </Text>
                        <View style={styles.stepper}>
                          <Pressable
                            style={styles.stepperBotao}
                            onPress={() => ajustarPercentual(s.id, -5)}
                            hitSlop={6}
                            accessibilityLabel={`Diminuir percentual de ${s.nome}`}
                          >
                            <Text style={styles.stepperSinal}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValor}>{valor}%</Text>
                          <Pressable
                            style={styles.stepperBotao}
                            onPress={() => ajustarPercentual(s.id, 5)}
                            hitSlop={6}
                            accessibilityLabel={`Aumentar percentual de ${s.nome}`}
                          >
                            <Text style={styles.stepperSinal}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View>
              <Text style={styles.label}>Tipo de despesa</Text>
              <View style={styles.gradeTipos}>
                {TIPOS_DESPESA.map((t) => {
                  const Icone = ICONE_TIPO_DESPESA[t];
                  const ativo = t === tipo;
                  return (
                    <Pressable
                      key={t}
                      style={[styles.tipoItem, ativo && styles.tipoItemAtivo]}
                      onPress={() => setTipo(t)}
                    >
                      <View style={[styles.tipoIcone, ativo && styles.tipoIconeAtivo]}>
                        <Icone size={17} color={ativo ? cores.green[700] : cores.stone[600]} />
                      </View>
                      <Text style={styles.tipoTexto}>{ROTULO_TIPO_DESPESA[t]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput
                style={styles.input}
                value={descricao}
                onChangeText={setDescricao}
                placeholder="Detalhe algo sobre essa despesa"
                placeholderTextColor={cores.stone[400]}
                maxLength={140}
              />
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.label, { textAlign: 'center' }]}>Valor</Text>
              <View style={styles.valorLinha}>
                <Text style={styles.valorPrefixo}>R$</Text>
                <TextInput
                  style={styles.valorInput}
                  value={formatarValorMascara(valorCentavos)}
                  onChangeText={alterarValor}
                  placeholder="0,00"
                  placeholderTextColor={cores.stone[400]}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Situação do pagamento</Text>
              <View style={{ flexDirection: 'row', gap: espacamento.sm }}>
                {(
                  [
                    { valor: 'pago' as const, titulo: 'Pago' },
                    { valor: 'pendente' as const, titulo: 'Pendente' },
                    ...(emEdicao ? [] : [{ valor: 'parcelado' as const, titulo: 'Parcelado' }]),
                  ]
                ).map(({ valor, titulo }) => {
                  const ativo = situacao === valor;
                  return (
                    <Pressable
                      key={valor}
                      style={[styles.situacaoChip, ativo && styles.situacaoChipAtiva]}
                      onPress={() => setSituacao(valor)}
                    >
                      <Text style={[styles.situacaoChipTexto, ativo && styles.situacaoChipTextoAtiva]}>{titulo}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {situacao !== 'pago' && (
                <View style={styles.blocoSituacao}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacamento.sm }}>
                    <Clock size={15} color={cores.amber.padrao} style={{ marginTop: 1 }} />
                    <Text style={styles.blocoSituacaoAviso}>
                      {situacao === 'pendente'
                        ? 'Essa despesa continua contando no cálculo de hoje, só ganha um selo "pendente" até você marcar como paga.'
                        : `A compra vira ${numParcelas} despesas separadas, cada uma marcada como pendente na sua data de vencimento.`}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.blocoRateioLabel, { textAlign: 'center' }]}>
                      {situacao === 'pendente' ? 'Vence em' : 'Vencimento da 1ª parcela'}
                    </Text>
                    <DateSelectorChip value={dataVencimento} onChange={setDataVencimento} />
                  </View>

                  {situacao === 'parcelado' && (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[styles.blocoRateioLabel, { textAlign: 'center' }]}>Número de parcelas</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento.md }}>
                        <Pressable
                          style={styles.parcelasBotao}
                          onPress={() => setNumParcelas((n) => Math.max(2, n - 1))}
                          hitSlop={6}
                          accessibilityLabel="Diminuir número de parcelas"
                        >
                          <Text style={styles.stepperSinal}>−</Text>
                        </Pressable>
                        <Text style={styles.parcelasValor}>{numParcelas}x</Text>
                        <Pressable
                          style={styles.parcelasBotao}
                          onPress={() => setNumParcelas((n) => Math.min(24, n + 1))}
                          hitSlop={6}
                          accessibilityLabel="Aumentar número de parcelas"
                        >
                          <Text style={styles.stepperSinal}>+</Text>
                        </Pressable>
                      </View>
                      {valorNumero > 0 && (
                        <Text style={styles.parcelasLegenda}>
                          de {formatarMoeda(splitParcelas(Number(valorCentavos), numParcelas)[0] / 100)} cada
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View>
              <Text style={styles.label}>Comprovante (opcional)</Text>
              {!foto ? (
                <Pressable style={styles.fotoVazia} onPress={tirarFoto}>
                  <Camera size={26} color={cores.stone[600]} strokeWidth={1.8} />
                  <Text style={styles.fotoVaziaTitulo}>Tirar foto do comprovante</Text>
                  <Text style={styles.fotoVaziaSub}>Toque para abrir a câmera</Text>
                </Pressable>
              ) : (
                <View style={styles.fotoPreenchida}>
                  <View style={styles.fotoPreenchidaInfo}>
                    <Image source={{ uri: foto }} style={styles.fotoThumb} />
                    <Text style={styles.fotoPreenchidaTexto}>Comprovante anexado</Text>
                  </View>
                  <Pressable onPress={() => setFoto(null)} accessibilityLabel="Remover comprovante" hitSlop={6}>
                    <X size={16} color={cores.red.padrao} />
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {!travadaPorAcerto && !semSociosEmCache && (
        <View style={styles.rodape}>
          <Pressable
            style={[styles.botaoPrimario, (!formValido || salvando) && styles.botaoDesabilitado]}
            onPress={salvar}
            disabled={!formValido || salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>
                {situacao === 'parcelado' && !emEdicao ? `Criar ${numParcelas} parcelas` : 'Salvar despesa'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
      </TelaComTeclado>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.cream[50],
  },
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
  tituloCabecalho: {
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  conteudo: {
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.lg,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 12,
    color: cores.amber.padrao,
    lineHeight: 17,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  linhaChips: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
    backgroundColor: '#FFFFFF',
  },
  chipAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  chipTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[700],
  },
  chipTextoAtivo: {
    color: '#FFFFFF',
  },
  avatarChip: {
    width: 18,
    height: 18,
    borderRadius: raio.pill,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipAtivo: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  avatarChipTexto: {
    fontSize: 8,
    fontWeight: '800',
    color: cores.green[800],
  },
  avatarChipTextoAtivo: {
    color: '#FFFFFF',
  },
  opcaoRateio: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md,
    backgroundColor: '#FFFFFF',
  },
  opcaoRateioAtiva: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  opcaoRateioIcone: {
    width: 32,
    height: 32,
    borderRadius: raio.sm + 2,
    backgroundColor: cores.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcaoRateioIconeAtivo: {
    backgroundColor: '#FFFFFF',
  },
  opcaoRateioTitulo: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  opcaoRateioSub: {
    fontSize: 11.3,
    color: cores.stone[400],
    marginTop: 2,
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  radioPonto: {
    width: 7,
    height: 7,
    borderRadius: raio.pill,
    backgroundColor: '#FFFFFF',
  },
  blocoRateio: {
    marginTop: espacamento.sm + 2,
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.green[100],
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  situacaoChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 2,
    backgroundColor: '#FFFFFF',
  },
  situacaoChipAtiva: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  situacaoChipTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[700],
  },
  situacaoChipTextoAtiva: {
    color: '#FFFFFF',
  },
  blocoSituacao: {
    marginTop: espacamento.sm + 2,
    gap: espacamento.md - 2,
    borderWidth: 1.5,
    borderColor: cores.amber.fundo,
    backgroundColor: '#fffaf1',
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  blocoSituacaoAviso: {
    flex: 1,
    fontSize: 11.3,
    lineHeight: 16,
    color: cores.amber.padrao,
  },
  parcelasBotao: {
    width: 34,
    height: 34,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  parcelasValor: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  parcelasLegenda: {
    marginTop: espacamento.xs + 2,
    fontSize: 12,
    color: cores.stone[600],
  },
  blocoRateioLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: cores.stone[600],
  },
  badgeSoma: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: espacamento.xs,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.xs + 2,
  },
  badgeSomaOk: {
    backgroundColor: cores.green[100],
  },
  badgeSomaErro: {
    backgroundColor: cores.red.fundo,
  },
  linhaPercentual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm,
    gap: espacamento.sm,
  },
  linhaPercentualNome: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
  },
  stepperBotao: {
    width: 25,
    height: 25,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSinal: {
    fontSize: 15,
    fontWeight: '700',
    color: cores.green[800],
  },
  stepperValor: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: cores.stone[900],
  },
  gradeTipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacamento.sm,
  },
  tipoItem: {
    width: '22%',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 4,
    backgroundColor: '#FFFFFF',
  },
  tipoItemAtivo: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  tipoIcone: {
    width: 32,
    height: 32,
    borderRadius: raio.sm + 2,
    backgroundColor: cores.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipoIconeAtivo: {
    backgroundColor: '#FFFFFF',
  },
  tipoTexto: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: cores.stone[700],
  },
  input: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    fontSize: 13.5,
    fontWeight: '500',
    color: cores.stone[900],
    backgroundColor: '#FFFFFF',
  },
  valorLinha: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacamento.xs + 2,
    borderBottomWidth: 2,
    borderBottomColor: cores.linha,
    paddingVertical: espacamento.sm + 4,
  },
  valorPrefixo: {
    fontSize: 22,
    fontWeight: '700',
    color: cores.stone[400],
  },
  valorInput: {
    minWidth: 160,
    fontSize: 36,
    fontWeight: '800',
    color: cores.stone[900],
    padding: 0,
  },
  fotoVazia: {
    alignItems: 'center',
    gap: espacamento.sm - 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.xl,
  },
  fotoVaziaTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[700],
  },
  fotoVaziaSub: {
    fontSize: 11,
    color: cores.stone[400],
  },
  fotoPreenchida: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  fotoPreenchidaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
  },
  fotoThumb: {
    width: 34,
    height: 34,
    borderRadius: raio.sm,
  },
  fotoPreenchidaTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: cores.cream[100],
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
  },
  botaoPrimario: {
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
    alignItems: 'center',
    backgroundColor: cores.green[800],
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
