import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, ChevronRight, FileDown, ShoppingCart, TrendingUp, Wallet } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useSafraAtiva } from '../context/SafraContext';
import { buscarSimulacaoPersonalizadaRequest, buscarSimulacaoRequest } from '../services/simulacao';
import { obterSimulacaoCache, salvarSimulacaoCache, type FiltroSimulacao } from '../lib/simulacaoCache';
import { listarVendasRequest } from '../services/vendas';
import { obterVendasCache, salvarVendasCache } from '../lib/vendasCache';
import { listarSociosDaSafraRequest } from '../services/safras';
import { obterSociosCache, salvarSociosCache } from '../lib/sociedadesCache';
import { calcularIntervaloPeriodo } from '../lib/periodoResumo';
import { formatarData } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { ROTULO_STATUS_SAFRA } from '../lib/rotulos';
import { PeriodToggle } from '../components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '../components/PeriodoAvancadoButton';
import { cores, espacamento, fonte, raio } from '../theme';
import type { PeriodoFiltro, Simulacao } from '../types/simulacao';
import type { Socio } from '../types/sociedade';
import type { VendaLocal } from '../types/venda';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { SafraTabParamList } from '../navigation/SafraTabs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SafraTabParamList, 'Resumo'>,
  NativeStackScreenProps<RootStackParamList>
>;

const RAIO_ANEL = 31;
const CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;

// Tela inicial da safra (aba "Resumo" da casca) — composição pura de dados já expostos por
// specs anteriores, sem chamada nova (docs/specs/mobile/08-navegacao-resumo-e-menu.md): painel
// de simulação (spec `05`, sem cálculo local), vendas recentes (spec `06`, filtradas aqui
// client-side pelo mesmo período do painel a partir da lista já em cache) e observações da
// safra (spec `03`). Absorve o que antes era PainelScreen.tsx. Segmented control de período,
// grid de cards e ordem das seções (vendas recentes antes de divisão do lucro) espelham
// frontend/src/pages/ResumoPage.tsx pixel a pixel — ajuste feito depois do dev comparar lado a
// lado com o web (2026-08-03). Card "Você recebe" e link "Ver sócios" (2026-08-03, ver
// docs/backlog.md) fecham a paridade visual com o web que ainda faltava.
export function ResumoScreen({ navigation }: Props) {
  const { usuario } = useAuth();
  const { safraAtiva } = useSafraAtiva();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado | null>(null);

  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [carregandoSimulacao, setCarregandoSimulacao] = useState(true);
  const [erroSimulacao, setErroSimulacao] = useState<string | null>(null);

  const [vendas, setVendas] = useState<VendaLocal[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);

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

  const carregarSocios = useCallback(async () => {
    const safraId = safraAtiva?.safraId;
    if (!safraId) return;
    // Reaproveita a mesma tabela de cache de sempre, agora chaveada por safra_id em vez de
    // sociedade_id (task 23, incremento) — sócios/percentuais passaram a ser por Safra.
    const cache = await obterSociosCache(safraId);
    if (cache.length > 0) setSocios(cache);
    try {
      const { socios: atualizados } = await listarSociosDaSafraRequest(safraId);
      await salvarSociosCache(safraId, atualizados);
      setSocios(atualizados);
    } catch {
      // offline: segue com o que já tinha em cache (ou vazio, até a próxima sincronização)
    }
  }, [safraAtiva?.safraId]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', () => {
      carregarSimulacao();
      carregarVendas();
      carregarSocios();
    });
    return desinscrever;
  }, [navigation, carregarSimulacao, carregarVendas, carregarSocios]);

  // `carregarSimulacao` muda de identidade a cada troca de período/personalizado (é o que a
  // deps list de `useCallback` captura) — sem este efeito, trocar o segmented control só
  // atualizava o estado local `periodo`, mas nunca disparava uma nova busca: o listener de
  // 'focus' acima só recarrega ao reentrar na aba, não a cada troca de filtro dentro dela.
  useEffect(() => {
    carregarSimulacao();
  }, [carregarSimulacao]);

  // Garante a primeira carga de vendas/sócios assim que a tela monta, sem depender só do
  // evento de foco — o foco não dispara de novo em toda remontagem do componente (ex: Fast
  // Refresh durante o desenvolvimento), deixando `vendas`/`socios` presos no estado inicial
  // vazio mesmo com a tela já visível.
  useEffect(() => {
    carregarVendas();
  }, [carregarVendas]);

  useEffect(() => {
    carregarSocios();
  }, [carregarSocios]);

  const [refrescando, setRefrescando] = useState(false);

  async function aoArrastar() {
    setRefrescando(true);
    await Promise.all([carregarSimulacao(), carregarVendas(), carregarSocios()]);
    setRefrescando(false);
  }

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPersonalizado(valor: PeriodoPersonalizado | null) {
    setPersonalizado(valor);
    setPeriodo(valor ? null : 'dia');
  }

  const meuSocio = socios.find((s) => s.usuario_id === usuario?.id);
  const souFinanciador = meuSocio?.papel === 'FINANCIADOR' || meuSocio?.papel === 'MISTO';
  const meuDivisao = simulacao?.divisao.find((d) => d.socio_id === meuSocio?.id) ?? null;
  const percentualAnel = Math.min(100, Math.max(0, meuDivisao?.percentual ?? 0));
  const offsetAnel = CIRCUNFERENCIA_ANEL * (1 - percentualAnel / 100);

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
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.conteudo}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={aoArrastar} tintColor={cores.green[700]} />}
    >
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

      {souFinanciador && (
        <Pressable
          style={styles.botaoRelatorio}
          onPress={() => navigation.navigate('Relatorio', { safraId: safraAtiva.safraId })}
        >
          <FileDown size={16} color={cores.green[700]} strokeWidth={2.2} />
          <Text style={styles.botaoRelatorioTexto}>Gerar relatório em PDF</Text>
        </Pressable>
      )}

      <View style={styles.filtroArea}>
        <PeriodToggle valor={periodo} onSelecionar={selecionarPeriodo} incluirSafra={false} />
        <PeriodoAvancadoButton
          periodo={periodo}
          personalizado={personalizado}
          onSelecionarPeriodo={selecionarPeriodo}
          onAplicarPersonalizado={selecionarPersonalizado}
        />
      </View>

      {erroSimulacao && <Text style={styles.erro}>{erroSimulacao}</Text>}
      {carregandoSimulacao && !simulacao && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}

      {simulacao && (
        <>
          <View style={styles.cardRecebe}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardRecebeLabel}>Você recebe (estimado)</Text>
              <Text style={styles.cardRecebeValor}>{formatarMoeda(meuDivisao?.valor ?? 0)}</Text>
              <Text style={styles.cardRecebePercentual}>Seu percentual: {meuDivisao?.percentual ?? 0}%</Text>
            </View>
            <View style={styles.anelArea}>
              <Svg width={74} height={74} viewBox="0 0 74 74" style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={37} cy={37} r={RAIO_ANEL} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={7} />
                <Circle
                  cx={37}
                  cy={37}
                  r={RAIO_ANEL}
                  fill="none"
                  stroke="#8fe6a0"
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUNFERENCIA_ANEL}
                  strokeDashoffset={offsetAnel}
                />
              </Svg>
              <View style={styles.anelTextoArea}>
                <Text style={styles.anelTexto}>{percentualAnel}%</Text>
              </View>
            </View>
          </View>

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
                <Text style={styles.cardValor}>{formatarMoeda(simulacao.despesas)}</Text>
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
                <View style={styles.linkComIcone}>
                  <Text style={styles.linkVerTodas}>Ver todas</Text>
                  <ChevronRight size={12} color={cores.green[700]} />
                </View>
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
            <View style={styles.secaoCabecalho}>
              <Text style={styles.tituloSecao}>Divisão do lucro</Text>
              <Pressable onPress={() => navigation.navigate('Socios', { safraId: safraAtiva.safraId })}>
                <View style={styles.linkComIcone}>
                  <Text style={styles.linkVerTodas}>Ver sócios</Text>
                  <ChevronRight size={12} color={cores.green[700]} />
                </View>
              </Pressable>
            </View>
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
  filtroArea: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  botaoRelatorio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: '#FFFFFF',
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 2,
  },
  botaoRelatorioTexto: {
    fontSize: fonte.legenda,
    fontWeight: '700',
    color: cores.green[700],
  },
  cabecalhoSafra: {
    gap: 2,
  },
  rotuloSafraAtual: {
    fontSize: fonte.legenda,
    color: cores.stone[600],
  },
  tituloSafra: {
    fontSize: fonte.tituloTela,
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
    fontSize: fonte.legenda,
    color: cores.stone[600],
  },
  badgeStatus: {
    fontSize: fonte.etiqueta,
    fontWeight: '700',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: 3,
  },
  observacoes: {
    marginTop: espacamento.xs,
    fontSize: fonte.legenda,
    color: cores.stone[400],
  },
  cardRecebe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.md,
    borderRadius: 18,
    backgroundColor: cores.green[900],
    padding: espacamento.lg,
  },
  cardRecebeLabel: {
    fontSize: fonte.legenda,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  cardRecebeValor: {
    fontSize: fonte.hero,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardRecebePercentual: {
    fontSize: fonte.auxiliar,
    color: 'rgba(255,255,255,0.85)',
    marginTop: espacamento.xs,
  },
  anelArea: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anelTextoArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anelTexto: {
    fontSize: fonte.destaqueMedio,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  linkComIcone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: fonte.textoPequeno,
    fontWeight: '500',
  },
  tituloSecao: {
    fontSize: fonte.tituloSecao,
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
    fontSize: fonte.auxiliar,
    color: cores.stone[600],
  },
  cardValor: {
    fontSize: fonte.valorDestaque,
    fontWeight: '800',
    color: cores.stone[900],
  },
  cardValorInline: {
    fontSize: fonte.valorDestaque,
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
    fontSize: fonte.textoPequeno,
    fontWeight: '800',
    color: cores.green[800],
  },
  linhaDivisaoTextos: {
    flex: 1,
  },
  linhaDivisaoNome: {
    fontSize: fonte.corpo,
    fontWeight: '700',
    color: cores.stone[900],
  },
  linhaDivisaoPercentual: {
    fontSize: fonte.etiqueta,
    color: cores.stone[400],
    marginTop: 1,
  },
  linhaDivisaoValor: {
    fontSize: fonte.valorSecundario,
    fontWeight: '800',
    color: cores.green[800],
  },
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  linkVerTodas: {
    fontSize: fonte.legenda,
    fontWeight: '700',
    color: cores.green[700],
  },
  vazio: {
    textAlign: 'center',
    fontSize: fonte.corpo,
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
    fontSize: fonte.corpo,
    fontWeight: '700',
    color: cores.stone[900],
  },
  itemVendaData: {
    fontSize: fonte.etiqueta,
    color: cores.stone[600],
    marginTop: 1,
  },
  itemVendaValor: {
    fontSize: fonte.valorSecundario,
    fontWeight: '800',
    color: cores.green[800],
  },
});
