import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Clock, Check } from 'lucide-react-native';
import { listarDespesasRequest } from '../services/despesas';
import { obterDespesasCache, salvarDespesasCache } from '../lib/despesasCache';
import { marcarDespesaComoPaga } from '../lib/despesasQueue';
import { assinarSincronizacaoConcluida } from '../lib/syncQueue';
import { useSafraAtiva } from '../context/SafraContext';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { calcularIntervaloPeriodo } from '../lib/periodoResumo';
import { formatarData } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { PeriodToggle } from '../components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '../components/PeriodoAvancadoButton';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro } from '../types/simulacao';
import type { DespesaLocal } from '../types/despesa';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { SafraTabParamList } from '../navigation/SafraTabs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SafraTabParamList, 'Despesas'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Lista de despesas da sociedade (aba "Despesas" da casca), equivalente à
// frontend/src/pages/DespesasPage.tsx do web — sem sugestões de regra recorrente (fora do
// escopo desta spec, ver docs/specs/mobile/04-despesas-da-sociedade.md e 06 mobile). O filtro de
// período (2026-08-03, ver docs/backlog.md) foi adicionado client-side sobre a lista completa já
// em cache, mesmo raciocínio de VendasScreen.tsx: `listarDespesasRequest` sempre traz a safra
// inteira (`periodo: 'safra'`) pra alimentar a fila de sincronização offline-first, então
// filtrar em memória evita uma segunda estratégia de cache só pra esta tela. Mostra o cache
// primeiro, sempre (mesmo offline), e atualiza quando a resposta da rede chega. Sem cabeçalho
// com seta de voltar (docs/specs/mobile/08-navegacao-resumo-e-menu.md): como aba raiz da casca,
// a navegação é só pela bottom nav, igual ao web dentro do SafraLayout.
export function DespesasScreen({ navigation }: Props) {
  const { safraAtiva } = useSafraAtiva();
  const safraId = safraAtiva?.safraId ?? '';
  const sociedadeId = safraAtiva?.sociedadeId ?? '';

  const [despesas, setDespesas] = useState<DespesaLocal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado | null>(null);
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [pagando, setPagando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!safraId) return;
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

  // Uma sincronização pode acontecer em segundo plano (ex: a conexão volta enquanto essa tela
  // já está aberta) sem nenhuma navegação disparar `carregar()` de novo — sem isso, o badge de
  // "pendente" só sumia se o produtor saísse e voltasse pra tela. Aqui é só uma releitura do
  // cache local (sem rede): a sincronização em si já gravou o resultado, só falta a tela notar.
  useEffect(() => {
    if (!safraId) return;
    const desinscrever = assinarSincronizacaoConcluida(() => {
      obterDespesasCache(safraId).then(setDespesas);
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
  const despesasDoPeriodo = useMemo(() => {
    const base = intervalo
      ? despesas.filter((d) => d.data.slice(0, 10) >= intervalo.dataInicio && d.data.slice(0, 10) <= intervalo.dataFim)
      : despesas;
    return somentePendentes ? base.filter((d) => d.status_pagamento === 'PENDENTE') : base;
  }, [despesas, intervalo, somentePendentes]);

  const totalDespesas = despesasDoPeriodo.reduce((acc, d) => acc + Number(d.valor), 0);

  async function marcarComoPago(d: DespesaLocal) {
    setErro(null);
    setPagando(d.id);
    try {
      await marcarDespesaComoPaga(safraId, d);
      setDespesas(await obterDespesasCache(safraId));
    } catch {
      setErro('Não foi possível marcar a despesa como paga');
    } finally {
      setPagando(null);
    }
  }

  if (!safraAtiva) return null;

  return (
    <>
      <View style={styles.cabecalho}>
        <Text style={styles.tituloCabecalho}>Despesas</Text>
      </View>

      <View style={styles.filtroArea}>
        <PeriodToggle valor={periodo} onSelecionar={selecionarPeriodo} incluirSafra={false} />
        <PeriodoAvancadoButton
          periodo={periodo}
          personalizado={personalizado}
          onSelecionarPeriodo={selecionarPeriodo}
          onAplicarPersonalizado={selecionarPersonalizado}
        />
      </View>

      <Pressable
        style={[styles.filtroPendentes, somentePendentes && styles.filtroPendentesAtivo]}
        onPress={() => setSomentePendentes((atual) => !atual)}
      >
        <Clock size={13} color={somentePendentes ? cores.amber.padrao : cores.stone[600]} strokeWidth={2.3} />
        <Text style={[styles.filtroPendentesTexto, somentePendentes && styles.filtroPendentesTextoAtivo]}>
          Só pendentes
        </Text>
      </Pressable>

      <View style={styles.resumo}>
        <View>
          <Text style={styles.resumoLabel}>Total de despesas no período</Text>
          <Text style={styles.resumoLegenda}>
            {despesasDoPeriodo.length} lançamento{despesasDoPeriodo.length === 1 ? '' : 's'} · todos os sócios
          </Text>
        </View>
        <Text style={styles.resumoValor}>{formatarMoeda(totalDespesas)}</Text>
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && despesas.length === 0 && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}
      {!carregando && despesasDoPeriodo.length === 0 && !erro && (
        <Text style={styles.vazio}>Nenhuma despesa neste período.</Text>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.lista}>
        {despesasDoPeriodo.map((d) => {
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
                {d.status_pagamento === 'PENDENTE' && (
                  <View style={styles.linhaPagamento}>
                    <View style={styles.badgePagamentoPendente}>
                      <Clock size={10} color={cores.amber.padrao} strokeWidth={2.6} />
                      <Text style={styles.badgePagamentoPendenteTexto}>
                        Pendente{d.data_vencimento ? ` · vence ${formatarData(d.data_vencimento)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.botaoMarcarPago}
                      onPress={() => marcarComoPago(d)}
                      disabled={pagando === d.id}
                      hitSlop={4}
                    >
                      <Check size={10} color="#FFFFFF" strokeWidth={2.6} />
                      <Text style={styles.botaoMarcarPagoTexto}>
                        {pagando === d.id ? 'Marcando...' : 'Marcar como pago'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={styles.itemValorArea}>
                <Text style={styles.itemValor}>{formatarMoeda(Number(d.valor))}</Text>
                <Text style={styles.itemData}>{formatarData(d.data)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    paddingHorizontal: espacamento.lg,
    paddingTop: espacamento.sm,
    paddingBottom: espacamento.xs,
  },
  tituloCabecalho: {
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  filtroArea: {
    flexDirection: 'row',
    gap: espacamento.sm,
    marginHorizontal: espacamento.xl,
    marginTop: espacamento.sm,
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: espacamento.xl,
    marginTop: espacamento.md,
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
  filtroPendentes: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    marginHorizontal: espacamento.xl,
    marginTop: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.xs + 2,
    backgroundColor: '#FFFFFF',
  },
  filtroPendentesAtivo: {
    borderColor: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
  },
  filtroPendentesTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: cores.stone[600],
  },
  filtroPendentesTextoAtivo: {
    color: cores.amber.padrao,
  },
  linhaPagamento: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    marginTop: espacamento.xs + 2,
  },
  badgePagamentoPendente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  badgePagamentoPendenteTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.amber.padrao,
  },
  botaoMarcarPago: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: cores.green[800],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  botaoMarcarPagoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
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
