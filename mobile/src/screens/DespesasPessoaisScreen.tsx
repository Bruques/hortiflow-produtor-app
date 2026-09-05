import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, ShieldCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listarDespesasPessoaisRequest } from '../services/despesasPessoais';
import { obterDespesasPessoaisCache, salvarDespesasPessoaisCache } from '../lib/despesasPessoaisCache';
import { assinarSincronizacaoConcluida } from '../lib/syncQueue';
import { calcularIntervaloPeriodo } from '../lib/periodoResumo';
import { PeriodToggle } from '../components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '../components/PeriodoAvancadoButton';
import { formatarData } from '../lib/data';
import { formatarMoeda } from '../lib/formatacao';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro } from '../types/simulacao';
import type { DespesaPessoalLocal } from '../types/despesa';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DespesasPessoais'>;

// Mobile 07 — lista de despesas pessoais da safra ativa, equivalente à
// frontend/src/pages/DespesasPessoaisPage.tsx do web. Alcançada via card do Menu, fora da
// casca de navegação (mesmo padrão de AcertosScreen.tsx) — não é uma das 4 abas.
export function DespesasPessoaisScreen({ navigation, route }: Props) {
  const { safraId } = route.params;

  const [despesas, setDespesas] = useState<DespesaPessoalLocal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado | null>(null);

  const carregar = useCallback(async () => {
    const cache = await obterDespesasPessoaisCache(safraId);
    if (cache.length > 0) {
      setDespesas(cache);
      setCarregando(false);
    }

    try {
      const { despesasPessoais: atualizadas } = await listarDespesasPessoaisRequest(safraId);
      await salvarDespesasPessoaisCache(safraId, atualizadas);
      setDespesas(await obterDespesasPessoaisCache(safraId));
      setErro(null);
    } catch {
      if (cache.length === 0) {
        setErro('Não foi possível carregar suas despesas pessoais');
      }
    } finally {
      setCarregando(false);
    }
  }, [safraId]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', carregar);
    return desinscrever;
  }, [navigation, carregar]);

  // Mesmo raciocínio de DespesasScreen.tsx: uma sincronização em segundo plano não dispara
  // navegação nenhuma — sem isso, o badge de "pendente" só sumia ao sair e voltar da tela.
  useEffect(() => {
    const desinscrever = assinarSincronizacaoConcluida(() => {
      obterDespesasPessoaisCache(safraId).then(setDespesas);
    });
    return desinscrever;
  }, [safraId]);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPersonalizado(valor: PeriodoPersonalizado | null) {
    setPersonalizado(valor);
    setPeriodo(valor ? null : 'dia');
  }

  const intervalo = useMemo(() => calcularIntervaloPeriodo(periodo, personalizado), [periodo, personalizado]);
  const despesasDoPeriodo = useMemo(
    () =>
      intervalo
        ? despesas.filter((d) => d.data.slice(0, 10) >= intervalo.dataInicio && d.data.slice(0, 10) <= intervalo.dataFim)
        : despesas,
    [despesas, intervalo]
  );

  const totalPeriodo = despesasDoPeriodo.reduce((acc, d) => acc + Number(d.valor), 0);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Despesas pessoais</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        <Pressable
          style={styles.botaoNovo}
          onPress={() => navigation.navigate('NovaDespesaPessoal', { safraId })}
        >
          <Plus size={17} color="#FFFFFF" />
          <Text style={styles.textoBotaoNovo}>Nova despesa pessoal</Text>
        </Pressable>

        <View style={styles.filtroArea}>
          <PeriodToggle valor={periodo} onSelecionar={selecionarPeriodo} incluirSafra={false} />
          <PeriodoAvancadoButton
            periodo={periodo}
            personalizado={personalizado}
            onSelecionarPeriodo={selecionarPeriodo}
            onAplicarPersonalizado={selecionarPersonalizado}
          />
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <View style={styles.aviso}>
          <ShieldCheck size={17} color={cores.green[700]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.avisoTitulo}>Só você vê essas despesas</Text>
            <Text style={styles.avisoTexto}>Não entram na divisão de lucro nem no extrato da sociedade</Text>
          </View>
        </View>

        <View style={styles.resumo}>
          <View>
            <Text style={styles.resumoLabel}>Total no período</Text>
            <Text style={styles.resumoLegenda}>
              {despesasDoPeriodo.length} lançamento{despesasDoPeriodo.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={styles.resumoValor}>{formatarMoeda(totalPeriodo)}</Text>
        </View>

        {carregando && despesas.length === 0 && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}
        {!carregando && despesasDoPeriodo.length === 0 && !erro && (
          <Text style={styles.vazio}>Nenhuma despesa pessoal neste período.</Text>
        )}

        {despesasDoPeriodo.map((d) => {
          const Icone = ICONE_TIPO_DESPESA[d.tipo];
          return (
            <Pressable
              key={d.id}
              style={styles.item}
              onPress={() => navigation.navigate('NovaDespesaPessoal', { safraId, despesaPessoal: d })}
            >
              <View style={styles.itemIcone}>
                <Icone size={18} color={cores.red.padrao} strokeWidth={2} />
              </View>
              <View style={styles.itemTextos}>
                <Text style={styles.itemTipo}>{ROTULO_TIPO_DESPESA[d.tipo]}</Text>
                {d.descricao && (
                  <Text style={styles.itemDescricao} numberOfLines={1}>
                    {d.descricao}
                  </Text>
                )}
                {d.pendenteOperacao && !d.erroSincronizacao && (
                  <Text style={styles.badgePendente}>Pendente de sincronização</Text>
                )}
                {d.erroSincronizacao && <Text style={styles.badgeErro}>Erro ao sincronizar</Text>}
              </View>
              <View style={styles.itemValorArea}>
                <Text style={styles.itemValor}>{formatarMoeda(Number(d.valor))}</Text>
                <Text style={styles.itemData}>{formatarData(d.data)}</Text>
              </View>
            </Pressable>
          );
        })}
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
    gap: espacamento.md,
  },
  botaoNovo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    borderRadius: raio.lg,
    backgroundColor: cores.green[800],
    paddingVertical: espacamento.md + 2,
  },
  textoBotaoNovo: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filtroArea: {
    flexDirection: 'row',
    gap: espacamento.sm,
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
    gap: espacamento.sm + 2,
    backgroundColor: cores.green[100],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  avisoTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  avisoTexto: {
    marginTop: 2,
    fontSize: 11.5,
    color: cores.stone[600],
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: cores.cream[100],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md + 2,
  },
  resumoLabel: {
    fontSize: 12,
    color: cores.stone[600],
  },
  resumoLegenda: {
    fontSize: 11,
    color: cores.stone[400],
    marginTop: 2,
  },
  resumoValor: {
    fontSize: 19,
    fontWeight: '800',
    color: cores.red.padrao,
  },
  vazio: {
    textAlign: 'center',
    fontSize: 13.5,
    color: cores.stone[600],
    marginTop: espacamento.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 4,
  },
  itemIcone: {
    width: 40,
    height: 40,
    borderRadius: raio.md,
    backgroundColor: cores.red.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextos: {
    flex: 1,
    minWidth: 0,
  },
  itemTipo: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.stone[900],
  },
  itemDescricao: {
    fontSize: 12,
    color: cores.stone[600],
    marginTop: 1,
  },
  badgePendente: {
    marginTop: 3,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    color: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.xs + 2,
    paddingVertical: 2,
  },
  badgeErro: {
    marginTop: 3,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    color: cores.red.padrao,
    backgroundColor: cores.red.fundo,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.xs + 2,
    paddingVertical: 2,
  },
  itemValorArea: {
    alignItems: 'flex-end',
  },
  itemValor: {
    fontSize: 14.5,
    fontWeight: '800',
    color: cores.red.padrao,
  },
  itemData: {
    marginTop: 2,
    fontSize: 11,
    color: cores.stone[400],
  },
});
