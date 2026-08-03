import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listarDespesasRequest } from '../services/despesas';
import { obterDespesasCache, salvarDespesasCache } from '../lib/despesasCache';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { formatarData } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { cores, espacamento, raio } from '../theme';
import type { DespesaLocal } from '../types/despesa';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Despesas'>;

// Lista de despesas da sociedade, equivalente à frontend/src/pages/DespesasPage.tsx do web —
// sem o filtro de período/sugestões de regra recorrente (fora do escopo desta spec, ver
// docs/specs/mobile/04-despesas-da-sociedade.md e 06 mobile). Mostra o cache primeiro,
// sempre (mesmo offline), e atualiza quando a resposta da rede chega.
export function DespesasScreen({ navigation, route }: Props) {
  const { safraId, sociedadeId } = route.params;

  const [despesas, setDespesas] = useState<DespesaLocal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const cache = await obterDespesasCache(safraId);
    if (cache.length > 0) {
      setDespesas(cache);
      setCarregando(false);
    }

    try {
      const { despesas: atualizadas } = await listarDespesasRequest(safraId);
      await salvarDespesasCache(safraId, atualizadas);
      setDespesas(await obterDespesasCache(safraId));
      setErro(null);
    } catch {
      if (cache.length === 0) {
        setErro('Não foi possível carregar as despesas');
      }
    } finally {
      setCarregando(false);
    }
  }, [safraId]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', carregar);
    return desinscrever;
  }, [navigation, carregar]);

  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Despesas</Text>
        <Pressable
          style={styles.botaoVoltar}
          onPress={() => navigation.navigate('NovaDespesa', { safraId, sociedadeId })}
          hitSlop={8}
          accessibilityLabel="Nova despesa"
        >
          <Plus size={19} color={cores.green[800]} />
        </Pressable>
      </View>

      <View style={styles.resumo}>
        <View>
          <Text style={styles.resumoLabel}>Total de despesas</Text>
          <Text style={styles.resumoLegenda}>
            {despesas.length} lançamento{despesas.length === 1 ? '' : 's'} · todos os sócios
          </Text>
        </View>
        <Text style={styles.resumoValor}>{formatarMoeda(totalDespesas)}</Text>
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && despesas.length === 0 && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}
      {!carregando && despesas.length === 0 && !erro && (
        <Text style={styles.vazio}>Nenhuma despesa lançada ainda.</Text>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.lista}>
        {despesas.map((d) => {
          const Icone = ICONE_TIPO_DESPESA[d.tipo];
          return (
            <Pressable
              key={d.id}
              style={styles.item}
              onPress={() => navigation.navigate('NovaDespesa', { safraId, sociedadeId, despesa: d })}
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
                <View style={styles.itemTags}>
                  <View style={styles.avatarPequeno}>
                    <Text style={styles.avatarPequenoTexto}>{iniciais(d.socio_nome)}</Text>
                  </View>
                  <Text style={styles.itemSocioNome}>{d.socio_nome}</Text>
                  {d.rateio && (
                    <Text style={styles.badgeRateio}>
                      {d.rateio.length === 1 ? `Rateio: só ${d.rateio[0].socio_nome}` : 'Rateio personalizado'}
                    </Text>
                  )}
                  {d.pendenteOperacao && !d.erroSincronizacao && (
                    <Text style={styles.badgePendente}>Pendente de sincronização</Text>
                  )}
                  {d.erroSincronizacao && <Text style={styles.badgeErro}>Erro ao sincronizar</Text>}
                </View>
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
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: espacamento.xl,
    marginTop: espacamento.sm,
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
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    marginTop: espacamento.md,
  },
  vazio: {
    textAlign: 'center',
    fontSize: 13.5,
    color: cores.stone[600],
    marginTop: espacamento.lg,
  },
  lista: {
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.md,
    paddingBottom: espacamento.lg,
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
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacamento.xs,
    marginTop: 3,
  },
  avatarPequeno: {
    width: 18,
    height: 18,
    borderRadius: raio.pill,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPequenoTexto: {
    fontSize: 8.5,
    fontWeight: '800',
    color: cores.green[800],
  },
  itemSocioNome: {
    fontSize: 12,
    color: cores.stone[600],
  },
  badgeRateio: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.stone[600],
    backgroundColor: cores.cream[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  badgePendente: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  badgeErro: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.red.padrao,
    backgroundColor: cores.red.fundo,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
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
    fontSize: 10.5,
    color: cores.stone[400],
    marginTop: 2,
  },
});
