import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ShoppingCart } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listarVendasRequest } from '../services/vendas';
import { obterVendasCache, salvarVendasCache } from '../lib/vendasCache';
import { assinarSincronizacaoConcluida } from '../lib/syncQueue';
import { obterRegrasCache, salvarRegrasCache } from '../lib/regrasCache';
import { listarRegrasRequest } from '../services/regrasDespesaRecorrente';
import { useSafraAtiva } from '../context/SafraContext';
import { calcularIntervaloPeriodo } from '../lib/periodoResumo';
import { formatarData } from '../lib/data';
import { formatarMoeda } from '../lib/formatacao';
import { PeriodToggle } from '../components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '../components/PeriodoAvancadoButton';
import { FiltroStatusPagamento, type StatusPagamento } from '../components/FiltroStatusPagamento';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro } from '../types/simulacao';
import type { VendaLocal } from '../types/venda';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { SafraTabParamList } from '../navigation/SafraTabs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SafraTabParamList, 'Vendas'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Lista de vendas da safra (aba "Vendas" da casca), equivalente à frontend/src/pages/VendasPage.tsx
// do web — sem o filtro de status de pagamento (fora do escopo desta spec, ver
// docs/specs/mobile/06-vendas-e-despesa-recorrente.md). O filtro de período (2026-08-03, ver
// docs/backlog.md) foi adicionado client-side sobre a lista completa já em cache — igual ao que
// "Vendas recentes" já fazia em ResumoScreen.tsx — em vez de re-buscar do backend por período: o
// service `listarVendasRequest` sempre traz a safra inteira (`periodo: 'safra'`) pra alimentar a
// fila de sincronização offline-first, então filtrar em memória evita uma segunda estratégia de
// cache só pra esta tela. Mostra o cache primeiro, sempre (mesmo offline), e atualiza quando a
// resposta da rede chega — mesmo padrão de DespesasScreen.tsx. Sem cabeçalho com seta de voltar
// (docs/specs/mobile/08-navegacao-resumo-e-menu.md): como aba raiz da casca, a navegação é só
// pela bottom nav, igual ao web dentro do SafraLayout.
export function VendasScreen({ navigation }: Props) {
  const { safraAtiva } = useSafraAtiva();
  const safraId = safraAtiva?.safraId ?? '';
  const sociedadeId = safraAtiva?.sociedadeId ?? '';

  const [vendas, setVendas] = useState<VendaLocal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('dia');
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado | null>(null);
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamento>('todas');
  // Valor de cada RegraDespesaRecorrente por id — cruzado com `venda.regras_aplicadas` (as
  // regras que o sócio realmente deixou marcadas ao lançar/editar essa venda específica) pra
  // calcular o selo "gerou despesa automática", igual à frontend/src/pages/VendasPage.tsx web.
  // Usar o estado atual da regra aqui seria errado: desativar uma regra depois não pode mudar
  // retroativamente a tag de vendas já lançadas.
  const [valorPorRegraId, setValorPorRegraId] = useState<Record<string, number>>({});

  const carregar = useCallback(async () => {
    if (!safraId) return;
    const cache = await obterVendasCache(safraId);
    if (cache.length > 0) {
      setVendas(cache);
      setCarregando(false);
    }

    try {
      const { vendas: atualizadas } = await listarVendasRequest(safraId);
      await salvarVendasCache(safraId, atualizadas);
      setVendas(await obterVendasCache(safraId));
      setErro(null);
    } catch {
      if (cache.length === 0) {
        setErro('Não foi possível carregar as vendas');
      }
    } finally {
      setCarregando(false);
    }
  }, [safraId]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', carregar);
    return desinscrever;
  }, [navigation, carregar]);

  useEffect(() => {
    if (!sociedadeId) return;
    (async () => {
      const cache = await obterRegrasCache(sociedadeId);
      if (cache.length > 0) setValorPorRegraId(Object.fromEntries(cache.map((r) => [r.id, Number(r.valor)])));
      try {
        const { regras } = await listarRegrasRequest(sociedadeId);
        await salvarRegrasCache(sociedadeId, regras);
        setValorPorRegraId(Object.fromEntries(regras.map((r) => [r.id, Number(r.valor)])));
      } catch {
        // offline: segue com o que já estava em cache (ou vazio, sem selo até conectar)
      }
    })();
  }, [sociedadeId]);

  // Mesmo motivo de DespesasScreen.tsx: uma sincronização em segundo plano precisa atualizar
  // a tela já aberta, sem esperar um próximo foco de navegação.
  useEffect(() => {
    if (!safraId) return;
    const desinscrever = assinarSincronizacaoConcluida(() => {
      obterVendasCache(safraId).then(setVendas);
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
  const vendasDoPeriodo = useMemo(
    () =>
      vendas
        .filter((v) =>
          intervalo ? v.data.slice(0, 10) >= intervalo.dataInicio && v.data.slice(0, 10) <= intervalo.dataFim : true
        )
        .filter((v) => (statusPagamento === 'todas' ? true : v.pago === (statusPagamento === 'pagas'))),
    [vendas, intervalo, statusPagamento]
  );

  const totalVendas = vendasDoPeriodo.reduce((acc, v) => acc + Number(v.total), 0);

  if (!safraAtiva) return null;

  return (
    <>
      <View style={styles.cabecalho}>
        <Text style={styles.tituloCabecalho}>Vendas</Text>
      </View>

      <View style={styles.filtroArea}>
        <View style={styles.filtroPeriodoLinha}>
          <PeriodToggle valor={periodo} onSelecionar={selecionarPeriodo} incluirSafra={false} />
          <PeriodoAvancadoButton
            periodo={periodo}
            personalizado={personalizado}
            onSelecionarPeriodo={selecionarPeriodo}
            onAplicarPersonalizado={selecionarPersonalizado}
          />
        </View>
        <FiltroStatusPagamento valor={statusPagamento} onSelecionar={setStatusPagamento} />
      </View>

      <View style={styles.resumo}>
        <View>
          <Text style={styles.resumoLabel}>Total vendido no período</Text>
          <Text style={styles.resumoLegenda}>
            {vendasDoPeriodo.length} lançamento{vendasDoPeriodo.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={styles.resumoValor}>{formatarMoeda(totalVendas)}</Text>
      </View>

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {carregando && vendas.length === 0 && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}
      {!carregando && vendasDoPeriodo.length === 0 && !erro && (
        <Text style={styles.vazio}>Nenhuma venda neste período.</Text>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.lista}>
        {vendasDoPeriodo.map((v) => {
          const valorAuto =
            v.regras_aplicadas.reduce((acc, regraId) => acc + (valorPorRegraId[regraId] ?? 0), 0) *
            Number(v.quantidade);
          return (
            <Pressable
              key={v.id}
              style={styles.item}
              onPress={() => navigation.navigate('NovaVenda', { safraId, sociedadeId, venda: v })}
            >
              <View style={styles.itemIcone}>
                <ShoppingCart size={18} color={cores.blue.padrao} strokeWidth={2} />
              </View>
              <View style={styles.itemTextos}>
                <Text style={styles.itemTipo}>
                  {v.quantidade} {v.unidade_nome} × {formatarMoeda(Number(v.preco))}
                </Text>
                {v.comprador && (
                  <Text style={styles.itemDescricao} numberOfLines={1}>
                    Comprador: {v.comprador}
                  </Text>
                )}
                <View style={styles.itemTags}>
                  <Text style={[styles.badgePago, v.pago ? styles.badgePagoAtivo : styles.badgePagoInativo]}>
                    {v.pago ? 'Pago' : 'A receber'}
                  </Text>
                  {v.pendenteOperacao && !v.erroSincronizacao && (
                    <Text style={styles.badgePendente}>Pendente de sincronização</Text>
                  )}
                  {v.erroSincronizacao && <Text style={styles.badgeErro}>Erro ao sincronizar</Text>}
                </View>
                {valorAuto > 0 && (
                  <View style={styles.badgeAuto}>
                    <Check size={9} color={cores.green[600]} strokeWidth={3} />
                    <Text style={styles.badgeAutoTexto}>gerou despesa automática de {formatarMoeda(valorAuto)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemValorArea}>
                <Text style={styles.itemValor}>{formatarMoeda(Number(v.total))}</Text>
                <Text style={styles.itemData}>{formatarData(v.data)}</Text>
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
    marginHorizontal: espacamento.xl,
    marginTop: espacamento.sm,
    gap: espacamento.sm,
  },
  filtroPeriodoLinha: {
    flexDirection: 'row',
    gap: espacamento.sm,
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
    color: cores.green[800],
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
    backgroundColor: cores.blue.fundo,
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
    marginTop: 5,
  },
  badgeAuto: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 3,
    marginTop: espacamento.xs,
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  badgeAutoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.green[600],
  },
  badgePago: {
    fontSize: 10,
    fontWeight: '700',
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  badgePagoAtivo: {
    color: cores.green[600],
    backgroundColor: cores.green[100],
  },
  badgePagoInativo: {
    color: cores.stone[600],
    backgroundColor: cores.cream[100],
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
    color: cores.green[800],
  },
  itemData: {
    fontSize: 10.5,
    color: cores.stone[400],
    marginTop: 2,
  },
});
