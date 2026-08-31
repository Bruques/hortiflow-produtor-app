import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Package, PieChart, ShoppingCart, TrendingUp, Wallet } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  buscarRelatorioCompletoPersonalizadoRequest,
  buscarRelatorioCompletoRequest,
} from '../services/simulacao';
import {
  obterRelatorioCompletoCache,
  salvarRelatorioCompletoCache,
  type FiltroRelatorioCompleto,
} from '../lib/relatorioCompletoCache';
import { useConectividade } from '../lib/useConectividade';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { formatarHora } from '../lib/data';
import { formatarMoeda } from '../lib/formatacao';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { PeriodToggle } from '../components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '../components/PeriodoAvancadoButton';
import { cores, espacamento, fonte, raio } from '../theme';
import type { PeriodoFiltro, RelatorioCompleto } from '../types/simulacao';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'RelatorioCompleto'>;

// Dashboard de leitura do período (docs/specs/mobile/10-relatorio-completo.md), portado de
// frontend/src/pages/RelatorioCompletoPage.tsx (docs/specs/21-relatorio-completo.md) — mesmo
// endpoint, sem restrição de papel (financiador e meeiro acessam igual, diferente do PDF em
// RelatorioScreen.tsx). Alcançada via card do Menu, fora da casca de navegação com cabeçalho
// próprio — mesmo padrão de AcertosScreen.tsx. Cache-then-network com aviso explícito de
// "sem conexão" quando offline (CLAUDE.md: nunca finge que o dado na tela está atualizado).
export function RelatorioCompletoScreen({ navigation, route }: Props) {
  const { safraId } = route.params;
  const conectado = useConectividade();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('mes');
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado | null>(null);

  const [relatorio, setRelatorio] = useState<RelatorioCompleto | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const filtro: FiltroRelatorioCompleto = personalizado
    ? { dataInicio: personalizado.dataInicio, dataFim: personalizado.dataFim }
    : { periodo: periodo ?? 'mes' };

  const carregar = useCallback(async () => {
    setCarregando(true);
    const cache = await obterRelatorioCompletoCache(safraId, filtro);
    if (cache) {
      setRelatorio(cache.relatorio);
      setAtualizadoEm(cache.atualizadoEm);
      setCarregando(false);
    }
    try {
      const resultado = personalizado
        ? await buscarRelatorioCompletoPersonalizadoRequest(safraId, personalizado.dataInicio, personalizado.dataFim)
        : await buscarRelatorioCompletoRequest(safraId, periodo ?? 'mes');
      const novoAtualizadoEm = await salvarRelatorioCompletoCache(safraId, filtro, resultado);
      setRelatorio(resultado);
      setAtualizadoEm(novoAtualizadoEm);
      setErro(null);
    } catch {
      if (!cache) setErro('Não foi possível carregar o relatório para este período');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safraId, periodo, personalizado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPersonalizado(valor: PeriodoPersonalizado | null) {
    setPersonalizado(valor);
    setPeriodo(valor ? null : 'mes');
  }

  const maiorCategoria = useMemo(
    () => Math.max(1, ...(relatorio?.despesasPorCategoria.map((c) => c.valor) ?? [1])),
    [relatorio]
  );

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Relatório completo</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        <View style={styles.filtroArea}>
          <PeriodToggle valor={periodo} onSelecionar={selecionarPeriodo} incluirSafra={false} />
          <PeriodoAvancadoButton
            periodo={periodo}
            personalizado={personalizado}
            onSelecionarPeriodo={selecionarPeriodo}
            onAplicarPersonalizado={selecionarPersonalizado}
          />
        </View>

        {!conectado && atualizadoEm && (
          <Text style={styles.avisoOffline}>Atualizado às {formatarHora(atualizadoEm)} — sem conexão</Text>
        )}

        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && !relatorio && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}
        {!conectado && !atualizadoEm && !carregando && (
          <Text style={styles.vazio}>Nenhum dado salvo — conecte-se à internet para carregar o relatório.</Text>
        )}

        {relatorio && (
          <>
            <View>
              <Text style={styles.tituloSecao}>Resumo do período</Text>
              <View style={styles.cardsGrid}>
                <View style={styles.cardMeio}>
                  <View style={[styles.cardIconeArea, { backgroundColor: cores.blue.fundo }]}>
                    <ShoppingCart size={17} color={cores.blue.padrao} />
                  </View>
                  <Text style={styles.cardLabel}>Receita (Vendas)</Text>
                  <Text style={styles.cardValor}>{formatarMoeda(relatorio.receita)}</Text>
                </View>
                <View style={styles.cardMeio}>
                  <View style={[styles.cardIconeArea, { backgroundColor: cores.red.fundo }]}>
                    <Wallet size={17} color={cores.red.padrao} />
                  </View>
                  <Text style={styles.cardLabel}>Despesas</Text>
                  <Text style={styles.cardValor}>{formatarMoeda(relatorio.despesas)}</Text>
                </View>
                <View style={styles.cardLucro}>
                  <View style={[styles.cardIconeArea, { backgroundColor: cores.green[100] }]}>
                    <TrendingUp size={17} color={cores.green[600]} />
                  </View>
                  <View style={styles.cardLucroTextos}>
                    <Text style={styles.cardLabel}>Lucro líquido</Text>
                    <Text style={[styles.cardValorInline, relatorio.lucroLiquido < 0 && { color: cores.red.padrao }]}>
                      {formatarMoeda(relatorio.lucroLiquido)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.tituloSecao}>Divisão do lucro</Text>
              {relatorio.divisao.length === 0 && <Text style={styles.vazio}>Sem lançamentos neste período.</Text>}
              {relatorio.divisao.map((d) => (
                <View key={d.socio_id} style={styles.linha}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linhaNome}>{d.nome}</Text>
                    <Text style={styles.linhaPercentual}>Percentual: {d.percentual}%</Text>
                  </View>
                  <Text style={[styles.linhaValor, d.valor < 0 && { color: cores.red.padrao }]}>
                    {formatarMoeda(d.valor)}
                  </Text>
                </View>
              ))}
            </View>

            <View>
              <View style={styles.secaoCabecalho}>
                <Package size={16} color={cores.blue.padrao} />
                <Text style={styles.tituloSecaoInline}>Vendas por unidade</Text>
              </View>
              {relatorio.quantidadePorUnidade.length === 0 && (
                <Text style={styles.vazio}>Nenhuma venda neste período.</Text>
              )}
              {relatorio.quantidadePorUnidade.map((q) => {
                const media = relatorio.mediaPrecoPorUnidade.find((m) => m.unidade_id === q.unidade_id);
                return (
                  <View key={q.unidade_id} style={styles.linha}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.linhaNome}>{q.unidade_nome}</Text>
                      <Text style={styles.linhaPercentual}>{q.quantidade} vendidas</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.mediaValor}>{formatarMoeda(media?.media_preco ?? 0)}</Text>
                      <Text style={styles.mediaLegenda}>Preço médio</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View>
              <View style={styles.secaoCabecalho}>
                <PieChart size={16} color={cores.amber.padrao} />
                <Text style={styles.tituloSecaoInline}>Despesas por categoria</Text>
              </View>
              {relatorio.despesasPorCategoria.length === 0 && (
                <Text style={styles.vazio}>Nenhuma despesa neste período.</Text>
              )}
              {relatorio.despesasPorCategoria
                .slice()
                .sort((a, b) => b.valor - a.valor)
                .map((c) => (
                  <View key={c.tipo} style={styles.categoriaLinha}>
                    <View style={styles.categoriaTextos}>
                      <Text style={styles.categoriaNome}>{ROTULO_TIPO_DESPESA[c.tipo]}</Text>
                      <Text style={styles.categoriaValor}>
                        {formatarMoeda(c.valor)} ({c.percentual.toFixed(0)}%)
                      </Text>
                    </View>
                    <View style={styles.barraFundo}>
                      <View style={[styles.barraPreenchida, { width: `${(c.valor / maiorCategoria) * 100}%` }]} />
                    </View>
                  </View>
                ))}
            </View>
          </>
        )}
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
    paddingBottom: espacamento.xxl + espacamento.lg,
    gap: espacamento.lg,
  },
  filtroArea: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  avisoOffline: {
    fontSize: 11.5,
    color: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 2,
    textAlign: 'center',
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
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    marginBottom: espacamento.sm + 2,
  },
  tituloSecaoInline: {
    fontSize: fonte.tituloSecao,
    fontWeight: '800',
    color: cores.stone[900],
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
  vazio: {
    textAlign: 'center',
    fontSize: fonte.corpo,
    color: cores.stone[600],
    marginTop: espacamento.sm,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 2,
  },
  linhaNome: {
    fontSize: fonte.corpo,
    fontWeight: '700',
    color: cores.stone[900],
  },
  linhaPercentual: {
    fontSize: fonte.etiqueta,
    color: cores.stone[400],
    marginTop: 1,
  },
  linhaValor: {
    fontSize: fonte.valorSecundario,
    fontWeight: '800',
    color: cores.green[800],
  },
  mediaValor: {
    fontSize: fonte.valorSecundario,
    fontWeight: '800',
    color: cores.green[800],
  },
  mediaLegenda: {
    fontSize: fonte.miniLegenda,
    color: cores.stone[400],
  },
  categoriaLinha: {
    paddingVertical: espacamento.xs + 2,
  },
  categoriaTextos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: espacamento.xs,
  },
  categoriaNome: {
    fontSize: fonte.corpo,
    fontWeight: '700',
    color: cores.stone[900],
  },
  categoriaValor: {
    fontSize: fonte.corpo,
    color: cores.stone[600],
  },
  barraFundo: {
    height: 8,
    width: '100%',
    borderRadius: raio.pill,
    backgroundColor: cores.cream[100],
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: raio.pill,
    backgroundColor: cores.amber.padrao,
  },
});
