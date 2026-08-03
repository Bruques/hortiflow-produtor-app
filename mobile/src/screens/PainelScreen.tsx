import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { buscarSimulacaoPersonalizadaRequest, buscarSimulacaoRequest } from '../services/simulacao';
import { obterSimulacaoCache, salvarSimulacaoCache, type FiltroSimulacao } from '../lib/simulacaoCache';
import { useConectividade } from '../lib/useConectividade';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { dataIsoParaExibicao, exibicaoParaDataIso, formatarHora } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro, Simulacao } from '../types/simulacao';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Painel'>;

const OPCOES_PERIODO: { valor: PeriodoFiltro; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra' },
];

// Painel de simulação, equivalente à frontend/src/pages/ResumoPage.tsx do web — sem cálculo
// local (docs/specs/mobile/05-painel-e-acerto.md): todo valor exibido vem direto de
// GET /safras/:id/simulacao. Mostra o cache do filtro atual primeiro (se houver) e atualiza
// por cima com a resposta da rede, igual ao padrão já usado em DespesasScreen.tsx.
export function PainelScreen({ navigation, route }: Props) {
  const { safraId } = route.params;
  const conectado = useConectividade();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [personalizado, setPersonalizado] = useState<{ dataInicio: string; dataFim: string } | null>(null);
  const [outraDataAberta, setOutraDataAberta] = useState(false);
  const [textoInicio, setTextoInicio] = useState('');
  const [textoFim, setTextoFim] = useState('');

  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const filtro: FiltroSimulacao = personalizado
    ? { dataInicio: personalizado.dataInicio, dataFim: personalizado.dataFim }
    : { periodo: periodo ?? 'dia' };

  const carregar = useCallback(async () => {
    setCarregando(true);
    const cache = await obterSimulacaoCache(safraId, filtro);
    if (cache) {
      setSimulacao(cache.simulacao);
      setAtualizadoEm(cache.atualizadoEm);
      setCarregando(false);
    } else {
      setSimulacao(null);
      setAtualizadoEm(null);
    }

    try {
      const resultado = personalizado
        ? await buscarSimulacaoPersonalizadaRequest(safraId, personalizado.dataInicio, personalizado.dataFim)
        : await buscarSimulacaoRequest(safraId, periodo ?? 'dia');
      const novoAtualizadoEm = await salvarSimulacaoCache(safraId, filtro, resultado);
      setSimulacao(resultado);
      setAtualizadoEm(novoAtualizadoEm);
      setErro(null);
    } catch {
      if (!cache) setErro('Não foi possível calcular o painel para este período');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safraId, periodo, personalizado]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', carregar);
    return desinscrever;
  }, [navigation, carregar]);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPersonalizado(null);
    setOutraDataAberta(false);
    setPeriodo(valor);
  }

  function abrirPersonalizado() {
    setTextoInicio(personalizado ? dataIsoParaExibicao(personalizado.dataInicio) : '');
    setTextoFim(personalizado ? dataIsoParaExibicao(personalizado.dataFim) : '');
    setOutraDataAberta(true);
  }

  function aplicarPersonalizado() {
    const dataInicio = exibicaoParaDataIso(textoInicio);
    const dataFim = exibicaoParaDataIso(textoFim);
    if (!dataInicio || !dataFim || dataInicio > dataFim) return;
    setPersonalizado({ dataInicio, dataFim });
    setPeriodo(null);
    setOutraDataAberta(false);
  }

  const semDadoParaEsteFiltro = !carregando && !simulacao && !erro;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Painel</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        <View style={styles.pills}>
          {OPCOES_PERIODO.map((opcao) => (
            <Pressable
              key={opcao.valor}
              style={[styles.pill, periodo === opcao.valor && styles.pillAtivo]}
              onPress={() => selecionarPeriodo(opcao.valor)}
            >
              <Text style={[styles.pillTexto, periodo === opcao.valor && styles.pillTextoAtivo]}>
                {opcao.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.pill, !!personalizado && styles.pillAtivo]}
            onPress={abrirPersonalizado}
          >
            <Text style={[styles.pillTexto, !!personalizado && styles.pillTextoAtivo]}>
              {personalizado
                ? `${dataIsoParaExibicao(personalizado.dataInicio)} – ${dataIsoParaExibicao(personalizado.dataFim)}`
                : 'Personalizado'}
            </Text>
          </Pressable>
        </View>

        {outraDataAberta && (
          <View style={styles.personalizadoCaixa}>
            <View style={styles.personalizadoLinha}>
              <TextInput
                style={styles.personalizadoInput}
                value={textoInicio}
                onChangeText={setTextoInicio}
                placeholder="Início DD/MM/AAAA"
                placeholderTextColor={cores.stone[400]}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.personalizadoInput}
                value={textoFim}
                onChangeText={setTextoFim}
                placeholder="Fim DD/MM/AAAA"
                placeholderTextColor={cores.stone[400]}
                keyboardType="numeric"
              />
            </View>
            <Pressable style={styles.botaoAplicar} onPress={aplicarPersonalizado}>
              <Text style={styles.textoBotaoAplicar}>Aplicar</Text>
            </Pressable>
          </View>
        )}

        {erro && <Text style={styles.erro}>{erro}</Text>}

        {!conectado && atualizadoEm && (
          <Text style={styles.avisoOffline}>
            Atualizado às {formatarHora(atualizadoEm)} — sem conexão para recalcular
          </Text>
        )}

        {carregando && !simulacao && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}

        {!conectado && semDadoParaEsteFiltro && (
          <Text style={styles.vazio}>
            Nenhum dado salvo para este período ainda. Conecte-se à internet para calcular.
          </Text>
        )}

        {simulacao && (
          <>
            <View style={styles.cards}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Receita</Text>
                <Text style={styles.cardValor}>{formatarMoeda(simulacao.receita)}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Despesas</Text>
                <Text style={[styles.cardValor, { color: cores.red.padrao }]}>
                  {formatarMoeda(simulacao.despesas)}
                </Text>
              </View>
              <View style={[styles.card, styles.cardLucro]}>
                <Text style={styles.cardLabel}>Lucro líquido</Text>
                <Text
                  style={[
                    styles.cardValor,
                    simulacao.lucroLiquido < 0 && { color: cores.red.padrao },
                  ]}
                >
                  {formatarMoeda(simulacao.lucroLiquido)}
                </Text>
              </View>
            </View>

            <View>
              <Text style={styles.tituloSecao}>Divisão do lucro</Text>
              {simulacao.divisao.map((d) => (
                <View key={d.socio_id} style={styles.linhaDivisao}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTexto}>{iniciais(d.nome)}</Text>
                  </View>
                  <View style={styles.linhaDivisaoTextos}>
                    <Text style={styles.linhaDivisaoNome}>{d.nome}</Text>
                    <Text style={styles.linhaDivisaoPercentual}>Percentual: {d.percentual}%</Text>
                  </View>
                  <Text style={[styles.linhaDivisaoValor, d.valor < 0 && { color: cores.red.padrao }]}>
                    {formatarMoeda(d.valor)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Pressable style={styles.linkAcertos} onPress={() => navigation.navigate('Acertos', { safraId })}>
          <FileText size={17} color={cores.green[800]} />
          <Text style={styles.linkAcertosTexto}>Ver histórico de acertos</Text>
          <ChevronRight size={16} color={cores.stone[400]} />
        </Pressable>
      </ScrollView>
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
    paddingTop: espacamento.md,
    paddingBottom: espacamento.xl,
    gap: espacamento.lg,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacamento.xs + 2,
  },
  pill: {
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm - 1,
  },
  pillAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  pillTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[700],
  },
  pillTextoAtivo: {
    color: '#FFFFFF',
  },
  personalizadoCaixa: {
    gap: espacamento.sm,
    backgroundColor: cores.cream[100],
    borderRadius: raio.md,
    padding: espacamento.md,
  },
  personalizadoLinha: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  personalizadoInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.sm + 2,
    paddingVertical: espacamento.sm,
    fontSize: 13,
    color: cores.stone[900],
    backgroundColor: '#FFFFFF',
  },
  botaoAplicar: {
    alignSelf: 'flex-start',
    borderRadius: raio.pill,
    backgroundColor: cores.green[800],
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.sm - 1,
  },
  textoBotaoAplicar: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  avisoOffline: {
    fontSize: 11.5,
    color: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 2,
  },
  vazio: {
    textAlign: 'center',
    fontSize: 13.5,
    color: cores.stone[600],
    marginTop: espacamento.lg,
  },
  cards: {
    gap: espacamento.sm + 2,
  },
  card: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  cardLucro: {
    backgroundColor: cores.green[100],
    borderColor: cores.green[100],
  },
  cardLabel: {
    fontSize: 12,
    color: cores.stone[600],
  },
  cardValor: {
    marginTop: 2,
    fontSize: 19,
    fontWeight: '800',
    color: cores.stone[900],
  },
  tituloSecao: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
    marginBottom: espacamento.sm,
  },
  linhaDivisao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: raio.pill,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: cores.green[800],
  },
  linhaDivisaoTextos: {
    flex: 1,
  },
  linhaDivisaoNome: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  linhaDivisaoPercentual: {
    fontSize: 11,
    color: cores.stone[400],
    marginTop: 1,
  },
  linhaDivisaoValor: {
    fontSize: 14,
    fontWeight: '800',
    color: cores.green[800],
  },
  linkAcertos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  linkAcertosTexto: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
});
