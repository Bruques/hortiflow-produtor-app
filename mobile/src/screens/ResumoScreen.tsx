import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar, CalendarRange, ShoppingCart, TrendingUp, Wallet } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafraAtiva } from '../context/SafraContext';
import { buscarSimulacaoPersonalizadaRequest, buscarSimulacaoRequest } from '../services/simulacao';
import { obterSimulacaoCache, salvarSimulacaoCache, type FiltroSimulacao } from '../lib/simulacaoCache';
import { listarVendasRequest } from '../services/vendas';
import { obterVendasCache, salvarVendasCache } from '../lib/vendasCache';
import { calcularIntervaloPeriodo } from '../lib/periodoResumo';
import { dataIsoParaExibicao, exibicaoParaDataIso, formatarData } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { ROTULO_STATUS_SAFRA } from '../lib/rotulos';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro, Simulacao } from '../types/simulacao';
import type { VendaLocal } from '../types/venda';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { SafraTabParamList } from '../navigation/SafraTabs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SafraTabParamList, 'Resumo'>,
  NativeStackScreenProps<RootStackParamList>
>;

const OPCOES_PERIODO: { valor: PeriodoFiltro; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra' },
];

// Tela inicial da safra (aba "Resumo" da casca) — composição pura de dados já expostos por
// specs anteriores, sem chamada nova (docs/specs/mobile/08-navegacao-resumo-e-menu.md): painel
// de simulação (spec `05`, sem cálculo local), vendas recentes (spec `06`, filtradas aqui
// client-side pelo mesmo período do painel a partir da lista já em cache) e observações da
// safra (spec `03`). Absorve o que antes era PainelScreen.tsx. Segmented control de período,
// grid de cards e ordem das seções (vendas recentes antes de divisão do lucro) espelham
// frontend/src/pages/ResumoPage.tsx pixel a pixel — ajuste feito depois do dev comparar lado a
// lado com o web (2026-08-03).
export function ResumoScreen({ navigation }: Props) {
  const { safraAtiva } = useSafraAtiva();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [personalizado, setPersonalizado] = useState<{ dataInicio: string; dataFim: string } | null>(null);
  const [outraDataAberta, setOutraDataAberta] = useState(false);
  const [textoInicio, setTextoInicio] = useState('');
  const [textoFim, setTextoFim] = useState('');

  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [carregandoSimulacao, setCarregandoSimulacao] = useState(true);
  const [erroSimulacao, setErroSimulacao] = useState<string | null>(null);

  const [vendas, setVendas] = useState<VendaLocal[]>([]);

  const filtro: FiltroSimulacao = personalizado
    ? { dataInicio: personalizado.dataInicio, dataFim: personalizado.dataFim }
    : { periodo: periodo ?? 'dia' };

  const carregarSimulacao = useCallback(async () => {
    if (!safraAtiva) return;
    setCarregandoSimulacao(true);
    const cache = await obterSimulacaoCache(safraAtiva.safraId, filtro);
    if (cache) {
      setSimulacao(cache.simulacao);
      setCarregandoSimulacao(false);
    }
    try {
      const resultado = personalizado
        ? await buscarSimulacaoPersonalizadaRequest(safraAtiva.safraId, personalizado.dataInicio, personalizado.dataFim)
        : await buscarSimulacaoRequest(safraAtiva.safraId, periodo ?? 'dia');
      await salvarSimulacaoCache(safraAtiva.safraId, filtro, resultado);
      setSimulacao(resultado);
      setErroSimulacao(null);
    } catch {
      if (!cache) setErroSimulacao('Não foi possível calcular o painel para este período');
    } finally {
      setCarregandoSimulacao(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safraAtiva?.safraId, periodo, personalizado]);

  const carregarVendas = useCallback(async () => {
    if (!safraAtiva) return;
    const cache = await obterVendasCache(safraAtiva.safraId);
    if (cache.length > 0) setVendas(cache);
    try {
      const { vendas: atualizadas } = await listarVendasRequest(safraAtiva.safraId);
      await salvarVendasCache(safraAtiva.safraId, atualizadas);
      setVendas(await obterVendasCache(safraAtiva.safraId));
    } catch {
      // offline: segue com o que já tinha em cache (ou vazio, até a próxima sincronização)
    }
  }, [safraAtiva?.safraId]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', () => {
      carregarSimulacao();
      carregarVendas();
    });
    return desinscrever;
  }, [navigation, carregarSimulacao, carregarVendas]);

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

  const intervaloVendas = useMemo(() => calcularIntervaloPeriodo(periodo, personalizado), [periodo, personalizado]);
  const vendasRecentes = useMemo(() => {
    const filtradas = intervaloVendas
      ? vendas.filter(
          (v) => v.data.slice(0, 10) >= intervaloVendas.dataInicio && v.data.slice(0, 10) <= intervaloVendas.dataFim
        )
      : vendas;
    return filtradas.slice(0, 5);
  }, [vendas, intervaloVendas]);

  if (!safraAtiva) return null;
  const { safra } = safraAtiva;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
      <Pressable onPress={() => navigation.navigate('Inicio')} style={styles.cabecalhoSafra}>
        <Text style={styles.rotuloSafraAtual}>Safra atual</Text>
        <Text style={styles.tituloSafra}>{safra.nome}</Text>
        <View style={styles.linhaStatus}>
          <View style={styles.dataLinha}>
            <Calendar size={13} color={cores.stone[600]} />
            <Text style={styles.dataTexto}>
              {safra.data_inicio && safra.data_fim
                ? `${formatarData(safra.data_inicio)} a ${formatarData(safra.data_fim)}`
                : safra.data_inicio
                  ? `Aberta em ${formatarData(safra.data_inicio)}`
                  : 'Datas não definidas'}
            </Text>
          </View>
          <Text style={styles.badgeStatus}>{ROTULO_STATUS_SAFRA[safra.status]}</Text>
        </View>
        {safra.observacoes && <Text style={styles.observacoes}>{safra.observacoes}</Text>}
      </Pressable>

      <View style={styles.segmentado}>
        {OPCOES_PERIODO.map((opcao) => (
          <Pressable
            key={opcao.valor}
            style={[styles.segmento, periodo === opcao.valor && styles.segmentoAtivo]}
            onPress={() => selecionarPeriodo(opcao.valor)}
          >
            <Text style={[styles.segmentoTexto, periodo === opcao.valor && styles.segmentoTextoAtivo]}>
              {opcao.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.botaoPersonalizado, !!personalizado && styles.botaoPersonalizadoAtivo]} onPress={abrirPersonalizado}>
        <CalendarRange size={16} color={personalizado ? '#FFFFFF' : cores.stone[600]} />
        <Text style={[styles.botaoPersonalizadoTexto, !!personalizado && styles.botaoPersonalizadoTextoAtivo]}>
          {personalizado
            ? `${dataIsoParaExibicao(personalizado.dataInicio)} - ${dataIsoParaExibicao(personalizado.dataFim)}`
            : 'Escolher período personalizado'}
        </Text>
      </Pressable>

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

      {erroSimulacao && <Text style={styles.erro}>{erroSimulacao}</Text>}
      {carregandoSimulacao && !simulacao && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}

      {simulacao && (
        <>
          <View>
            <Text style={styles.tituloSecao}>Resumo do período</Text>
            <View style={styles.cardsGrid}>
              <View style={styles.cardMeio}>
                <View style={[styles.cardIconeArea, { backgroundColor: cores.blue.fundo }]}>
                  <ShoppingCart size={17} color={cores.blue.padrao} />
                </View>
                <Text style={styles.cardLabel}>Receita (Vendas)</Text>
                <Text style={styles.cardValor}>{formatarMoeda(simulacao.receita)}</Text>
              </View>
              <View style={styles.cardMeio}>
                <View style={[styles.cardIconeArea, { backgroundColor: cores.red.fundo }]}>
                  <Wallet size={17} color={cores.red.padrao} />
                </View>
                <Text style={styles.cardLabel}>Despesas</Text>
                <Text style={[styles.cardValor, { color: cores.red.padrao }]}>{formatarMoeda(simulacao.despesas)}</Text>
              </View>
              <View style={styles.cardLucro}>
                <View style={[styles.cardIconeArea, { backgroundColor: cores.green[100] }]}>
                  <TrendingUp size={17} color={cores.green[600]} />
                </View>
                <View style={styles.cardLucroTextos}>
                  <Text style={styles.cardLabel}>Lucro líquido</Text>
                  <Text style={[styles.cardValorInline, simulacao.lucroLiquido < 0 && { color: cores.red.padrao }]}>
                    {formatarMoeda(simulacao.lucroLiquido)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View>
            <View style={styles.secaoCabecalho}>
              <Text style={styles.tituloSecao}>Vendas recentes</Text>
              <Pressable onPress={() => navigation.navigate('Vendas')}>
                <Text style={styles.linkVerTodas}>Ver todas</Text>
              </Pressable>
            </View>
            {vendasRecentes.length === 0 && <Text style={styles.vazio}>Nenhuma venda neste período.</Text>}
            {vendasRecentes.map((v) => (
              <View key={v.id} style={styles.itemVenda}>
                <View style={styles.itemVendaIcone}>
                  <ShoppingCart size={18} color={cores.blue.padrao} strokeWidth={2} />
                </View>
                <View style={styles.itemVendaTextos}>
                  <Text style={styles.itemVendaTitulo}>
                    {v.quantidade} {v.unidade_nome} × {formatarMoeda(Number(v.preco))}
                  </Text>
                  <Text style={styles.itemVendaData}>{formatarData(v.data)}</Text>
                </View>
                <Text style={styles.itemVendaValor}>{formatarMoeda(Number(v.total))}</Text>
              </View>
            ))}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.md,
    paddingBottom: espacamento.xxl + espacamento.lg,
    gap: espacamento.lg,
  },
  cabecalhoSafra: {
    gap: 2,
  },
  rotuloSafraAtual: {
    fontSize: 12.5,
    color: cores.stone[600],
  },
  tituloSafra: {
    fontSize: 20,
    fontWeight: '800',
    color: cores.stone[900],
  },
  linhaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espacamento.xs,
  },
  dataLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs,
  },
  dataTexto: {
    fontSize: 12.5,
    color: cores.stone[600],
  },
  badgeStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: 3,
  },
  observacoes: {
    marginTop: espacamento.xs,
    fontSize: 12.5,
    color: cores.stone[400],
  },
  segmentado: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: cores.cream[100],
    borderRadius: raio.md + 2,
    padding: 4,
  },
  segmento: {
    flex: 1,
    borderRadius: raio.sm + 2,
    paddingVertical: espacamento.sm,
    alignItems: 'center',
  },
  segmentoAtivo: {
    backgroundColor: '#FFFFFF',
  },
  segmentoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  segmentoTextoAtivo: {
    color: cores.green[800],
  },
  botaoPersonalizado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xs + 2,
    height: 38,
    borderRadius: raio.md + 2,
    backgroundColor: cores.cream[100],
  },
  botaoPersonalizadoAtivo: {
    backgroundColor: cores.green[800],
  },
  botaoPersonalizadoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  botaoPersonalizadoTextoAtivo: {
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
  tituloSecao: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
    marginBottom: espacamento.sm + 2,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacamento.sm + 2,
  },
  cardMeio: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  cardLucro: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.md,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  cardLucroTextos: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconeArea: {
    width: 34,
    height: 34,
    borderRadius: raio.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    color: cores.stone[600],
  },
  cardValor: {
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  cardValorInline: {
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
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
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  linkVerTodas: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
  },
  vazio: {
    textAlign: 'center',
    fontSize: 13.5,
    color: cores.stone[600],
    marginTop: espacamento.sm,
  },
  itemVenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 2,
  },
  itemVendaIcone: {
    width: 40,
    height: 40,
    borderRadius: raio.md,
    backgroundColor: cores.blue.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemVendaTextos: {
    flex: 1,
  },
  itemVendaTitulo: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  itemVendaData: {
    fontSize: 11,
    color: cores.stone[400],
    marginTop: 1,
  },
  itemVendaValor: {
    fontSize: 14,
    fontWeight: '800',
    color: cores.green[800],
  },
});
