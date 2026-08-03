import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Percent, Plus, Receipt, SlidersHorizontal, User, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { obterSociosCache } from '../lib/sociedadesCache';
import { listarSociosRequest } from '../services/sociedades';
import { atualizarAtivoRequest, criarRegraRequest, listarRegrasRequest, listarSugestoesRequest } from '../services/regrasDespesaRecorrente';
import { listarUnidadesRequest } from '../services/unidadesVenda';
import { obterSugestoesCache, salvarSugestoesCache } from '../lib/sugestoesCache';
import { confirmarSugestao } from '../lib/sugestaoQueue';
import { assinarSincronizacaoConcluida } from '../lib/syncQueue';
import { mensagemErro } from '../lib/erroApi';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { formatarMoeda } from '../lib/formatacao';
import { cores, espacamento, raio } from '../theme';
import type { Socio } from '../types/sociedade';
import type { UnidadeVenda } from '../types/unidadeVenda';
import type { RegraDespesaRecorrente, SugestaoDespesaRecorrente, TipoGatilhoRegra } from '../types/regraDespesaRecorrente';
import type { TipoDespesa } from '../types/despesa';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'RegrasDespesa'>;

type ModoRateio = 'padrao' | 'exclusivo' | 'personalizado';
const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

// Configuração de regras de despesa recorrente + "sugestões do dia" — equivalente à
// frontend/src/pages/ConfiguracoesRegrasDespesaPage.tsx do web, mais o bloco de sugestões que
// no web mora em DespesasPage.tsx. Criar/editar regra exige conexão; confirmar uma sugestão é
// offline (docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
export function ConfiguracoesRegrasDespesaScreen({ navigation, route }: Props) {
  const { sociedadeId, safraId } = route.params;
  const { usuario } = useAuth();

  const [souFinanciador, setSouFinanciador] = useState(false);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);
  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [sugestoes, setSugestoes] = useState<SugestaoDespesaRecorrente[]>([]);
  const [sugestoesDispensadas, setSugestoesDispensadas] = useState<Set<string>>(new Set());

  const [novaAberta, setNovaAberta] = useState(false);
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoRegra>('POR_VENDA');
  const [tipoDespesaRegra, setTipoDespesaRegra] = useState<TipoDespesa>('OUTRO');
  const [valorCentavos, setValorCentavos] = useState('');
  const [unidadeRegra, setUnidadeRegra] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [modoRateio, setModoRateio] = useState<ModoRateio>('padrao');
  const [rateioExclusivoId, setRateioExclusivoId] = useState('');
  const [rateioPercentuais, setRateioPercentuais] = useState<Record<string, string>>({});

  async function carregarRegras() {
    setCarregando(true);
    try {
      const { regras: atualizadas } = await listarRegrasRequest(sociedadeId);
      setRegras(atualizadas);
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível carregar as regras'));
    } finally {
      setCarregando(false);
    }
  }

  async function carregarSugestoes() {
    const cache = await obterSugestoesCache(safraId);
    if (cache.length > 0) setSugestoes(cache);
    try {
      const { sugestoes: atualizadas } = await listarSugestoesRequest(safraId);
      await salvarSugestoesCache(safraId, atualizadas);
      setSugestoes(await obterSugestoesCache(safraId));
    } catch {
      // offline: segue com o que já estava em cache
    }
  }

  useEffect(() => {
    carregarRegras();
    carregarSugestoes();
    (async () => {
      const cacheSocios = await obterSociosCache(sociedadeId);
      if (cacheSocios.length > 0) {
        setSocios(cacheSocios);
        setRateioExclusivoId((atual) => atual || cacheSocios[0].id);
      }
      try {
        const [resSocios, resUnidades] = await Promise.all([
          listarSociosRequest(sociedadeId),
          listarUnidadesRequest(sociedadeId),
        ]);
        setSocios(resSocios.socios);
        setRateioExclusivoId((atual) => atual || resSocios.socios[0]?.id || '');
        setUnidades(resUnidades.unidades);
        const primeiraAtiva = resUnidades.unidades.find((u) => u.ativo);
        if (primeiraAtiva) setUnidadeRegra((atual) => atual || primeiraAtiva.id);
        const eu = resSocios.socios.find((s) => s.usuario_id === usuario?.id);
        setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
      } catch {
        // offline: segue com o que o cache já indicava (papel fica indefinido até conectar)
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId, safraId]);

  // Uma sincronização em segundo plano (ex: confirmação de sugestão feita offline) precisa
  // atualizar a lista sem esperar um novo foco de navegação — mesmo padrão de DespesasScreen.tsx.
  useEffect(() => {
    const desinscrever = assinarSincronizacaoConcluida(() => {
      obterSugestoesCache(safraId).then(setSugestoes);
    });
    return desinscrever;
  }, [safraId]);

  async function alternarAtivo(regra: RegraDespesaRecorrente) {
    setErro(null);
    try {
      await atualizarAtivoRequest(regra.id, !regra.ativo);
      await carregarRegras();
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível atualizar a regra'));
    }
  }

  const somaRateioPersonalizado = socios.reduce(
    (acc, s) => acc + (Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0),
    0
  );
  const rateioValido =
    modoRateio === 'padrao' ||
    (modoRateio === 'exclusivo' && !!rateioExclusivoId) ||
    (modoRateio === 'personalizado' && Math.abs(somaRateioPersonalizado - 100) <= 0.01);

  function selecionarPersonalizado() {
    setModoRateio('personalizado');
    if (Object.keys(rateioPercentuais).length === 0 && socios.length > 0) {
      const base = Math.floor(100 / socios.length);
      const resto = 100 - base * socios.length;
      setRateioPercentuais(Object.fromEntries(socios.map((s, i) => [s.id, String(base + (i === 0 ? resto : 0))])));
    }
  }

  function ajustarPercentual(id: string, delta: number) {
    setRateioPercentuais((atual) => {
      const valorAtual = Number(atual[id]?.replace(',', '.')) || 0;
      const novoValor = Math.min(100, Math.max(0, valorAtual + delta));
      return { ...atual, [id]: String(novoValor) };
    });
  }

  function rateioParaEnviar(): { socio_id: string; percentual: number }[] | undefined {
    if (modoRateio === 'padrao') return undefined;
    if (modoRateio === 'exclusivo') return [{ socio_id: rateioExclusivoId, percentual: 100 }];
    return socios
      .map((s) => ({ socio_id: s.id, percentual: Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0 }))
      .filter((r) => r.percentual > 0);
  }

  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;
  const unidadesAtivas = unidades.filter((u) => u.ativo);
  const formNovaRegraValida =
    !!valorCentavos && rateioValido && (tipoGatilho !== 'POR_VENDA' || !!unidadeRegra);

  async function criarRegra() {
    if (!formNovaRegraValida) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarRegraRequest(sociedadeId, {
        tipo_gatilho: tipoGatilho,
        tipo_despesa: tipoDespesaRegra,
        valor: valorNumero,
        unidade_id: tipoGatilho === 'POR_VENDA' ? unidadeRegra : undefined,
        rateio: rateioParaEnviar(),
      });
      setValorCentavos('');
      setModoRateio('padrao');
      setRateioPercentuais({});
      setNovaAberta(false);
      await carregarRegras();
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível criar a regra'));
    } finally {
      setSalvando(false);
    }
  }

  const sugestoesVisiveis = sugestoes.filter((s) => !sugestoesDispensadas.has(s.id));

  async function confirmar(sugestao: SugestaoDespesaRecorrente) {
    setSugestoes((atual) => atual.filter((s) => s.id !== sugestao.id));
    await confirmarSugestao(safraId, sugestao);
  }

  function dispensar(id: string) {
    setSugestoesDispensadas((atual) => new Set(atual).add(id));
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Regras de despesa</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {sugestoesVisiveis.map((s) => (
          <View key={s.id} style={styles.sugestao}>
            <Pressable style={styles.sugestaoFechar} onPress={() => dispensar(s.id)} hitSlop={6} accessibilityLabel="Dispensar sugestão">
              <X size={15} color={cores.amber.padrao} />
            </Pressable>
            <View style={styles.sugestaoIcone}>
              <Receipt size={18} color={cores.amber.padrao} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sugestaoTitulo}>
                {ROTULO_TIPO_DESPESA[s.tipo_despesa]} · {formatarMoeda(Number(s.valor))}
              </Text>
              <Text style={styles.sugestaoSub}>Regra recorrente de hoje — toque pra confirmar o lançamento</Text>
              <Pressable style={styles.sugestaoBotao} onPress={() => confirmar(s)}>
                <Text style={styles.sugestaoBotaoTexto}>Confirmar despesa</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View>
          <Text style={styles.tituloSecao}>Despesa recorrente</Text>
          <Text style={styles.subtituloSecao}>Só o financiador cria ou edita regras</Text>
        </View>

        {carregando && regras.length === 0 && <ActivityIndicator />}
        {!carregando && regras.length === 0 && <Text style={styles.vazio}>Nenhuma regra criada ainda.</Text>}

        {regras.map((r) => {
          const Icone = ICONE_TIPO_DESPESA[r.tipo_despesa];
          const porVenda = r.tipo_gatilho === 'POR_VENDA';
          return (
            <View key={r.id} style={styles.cardRegra}>
              <View style={[styles.cardRegraIcone, { backgroundColor: porVenda ? cores.green[100] : cores.amber.fundo }]}>
                <Icone size={18} color={porVenda ? cores.green[600] : cores.amber.padrao} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardRegraTitulo}>
                  {formatarMoeda(Number(r.valor))}{' '}
                  {porVenda ? `por ${r.unidade_nome?.toLowerCase() ?? 'unidade'} vendida` : `· ${ROTULO_TIPO_DESPESA[r.tipo_despesa]}`}
                </Text>
                <View style={styles.cardRegraTags}>
                  <Text style={[styles.badgeGatilho, porVenda ? styles.badgeGatilhoVenda : styles.badgeGatilhoPeriodo]}>
                    {porVenda ? 'Por venda' : 'Por período · sugestão'}
                  </Text>
                  {r.rateio && (
                    <Text style={styles.badgeRateio}>
                      {r.rateio.length === 1 ? `Rateio: só ${r.rateio[0].socio_nome}` : 'Rateio personalizado'}
                    </Text>
                  )}
                </View>
              </View>
              <Switch
                value={r.ativo}
                onValueChange={() => alternarAtivo(r)}
                disabled={!souFinanciador}
                trackColor={{ false: cores.cream[100], true: cores.green[700] }}
                thumbColor="#FFFFFF"
              />
            </View>
          );
        })}

        {souFinanciador && !novaAberta && (
          <Pressable style={styles.botaoAdicionar} onPress={() => setNovaAberta(true)}>
            <Plus size={16} color={cores.green[700]} />
            <Text style={styles.botaoAdicionarTexto}>Nova regra</Text>
          </Pressable>
        )}

        {souFinanciador && novaAberta && (
          <View style={styles.formNova}>
            <View>
              <Text style={styles.label}>Gatilho</Text>
              <View style={styles.linhaChips}>
                {(
                  [
                    { valor: 'POR_VENDA' as const, texto: 'Por venda' },
                    { valor: 'POR_PERIODO' as const, texto: 'Por período' },
                  ]
                ).map((opcao) => {
                  const ativo = tipoGatilho === opcao.valor;
                  return (
                    <Pressable
                      key={opcao.valor}
                      style={[styles.chip, ativo && styles.chipAtivo]}
                      onPress={() => setTipoGatilho(opcao.valor)}
                    >
                      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{opcao.texto}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {tipoGatilho === 'POR_VENDA' && (
              <View>
                <Text style={styles.label}>Unidade</Text>
                {unidadesAtivas.length === 0 ? (
                  <Text style={styles.erroInline}>Cadastre uma unidade de venda antes de criar essa regra.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.linhaChips}>
                      {unidadesAtivas.map((u) => {
                        const ativo = unidadeRegra === u.id;
                        return (
                          <Pressable
                            key={u.id}
                            style={[styles.chip, ativo && styles.chipAtivo]}
                            onPress={() => setUnidadeRegra(u.id)}
                          >
                            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{u.nome}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>
            )}

            <View>
              <Text style={styles.label}>Tipo de despesa gerada</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.linhaChips}>
                  {TIPOS_DESPESA.map((t) => {
                    const ativo = tipoDespesaRegra === t;
                    return (
                      <Pressable
                        key={t}
                        style={[styles.chip, ativo && styles.chipAtivo]}
                        onPress={() => setTipoDespesaRegra(t)}
                      >
                        <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{ROTULO_TIPO_DESPESA[t]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>{tipoGatilho === 'POR_VENDA' ? 'Valor por unidade (R$)' : 'Valor fixo (R$)'}</Text>
              <View style={styles.valorLinha}>
                <Text style={styles.valorPrefixo}>R$</Text>
                <TextInput
                  style={styles.valorInput}
                  value={formatarValorMascara(valorCentavos)}
                  onChangeText={(t) => setValorCentavos(t.replace(/\D/g, '').slice(0, 9))}
                  placeholder="0,00"
                  placeholderTextColor={cores.stone[400]}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Quem paga a despesa gerada por essa regra?</Text>
              <View style={{ gap: espacamento.sm }}>
                {(
                  [
                    { modo: 'padrao' as const, titulo: 'Dividir como o lucro', Icone: Percent },
                    { modo: 'exclusivo' as const, titulo: 'Só de um sócio', Icone: User },
                    { modo: 'personalizado' as const, titulo: 'Personalizado', Icone: SlidersHorizontal },
                  ]
                ).map(({ modo, titulo, Icone }) => {
                  const ativo = modoRateio === modo;
                  return (
                    <Pressable
                      key={modo}
                      style={[styles.opcaoRateio, ativo && styles.opcaoRateioAtiva]}
                      onPress={() => (modo === 'personalizado' ? selecionarPersonalizado() : setModoRateio(modo))}
                    >
                      <Icone size={16} color={ativo ? cores.green[700] : cores.stone[600]} />
                      <Text style={styles.opcaoRateioTitulo}>{titulo}</Text>
                      {ativo && <Check size={14} color={cores.green[700]} />}
                    </Pressable>
                  );
                })}
              </View>

              {modoRateio === 'exclusivo' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: espacamento.sm }}>
                  <View style={styles.linhaChips}>
                    {socios.map((s) => {
                      const ativo = s.id === rateioExclusivoId;
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, ativo && styles.chipAtivo]}
                          onPress={() => setRateioExclusivoId(s.id)}
                        >
                          <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{s.nome}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {modoRateio === 'personalizado' && (
                <View style={styles.blocoRateio}>
                  <Text style={[styles.badgeSoma, Math.abs(somaRateioPersonalizado - 100) <= 0.01 ? styles.badgeSomaOk : styles.badgeSomaErro]}>
                    Total: {somaRateioPersonalizado.toFixed(0)}%
                    {Math.abs(somaRateioPersonalizado - 100) > 0.01 ? ' (precisa fechar em 100%)' : ''}
                  </Text>
                  {socios.map((s) => {
                    const valor = Number(rateioPercentuais[s.id]?.replace(',', '.')) || 0;
                    return (
                      <View key={s.id} style={styles.linhaPercentual}>
                        <Text style={styles.linhaPercentualNome} numberOfLines={1}>
                          {s.nome}
                        </Text>
                        <View style={styles.stepper}>
                          <Pressable style={styles.stepperBotao} onPress={() => ajustarPercentual(s.id, -5)} hitSlop={6}>
                            <Text style={styles.stepperSinal}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValor}>{valor}%</Text>
                          <Pressable style={styles.stepperBotao} onPress={() => ajustarPercentual(s.id, 5)} hitSlop={6}>
                            <Text style={styles.stepperSinal}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.linhaBotoes}>
              <Pressable style={styles.botaoSecundario} onPress={() => setNovaAberta(false)}>
                <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.botaoPrimario, (salvando || !formNovaRegraValida) && styles.botaoDesabilitado]}
                onPress={criarRegra}
                disabled={salvando || !formNovaRegraValida}
              >
                <Text style={styles.textoBotaoPrimario}>{salvando ? 'Criando...' : 'Criar regra'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
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
  conteudo: { paddingHorizontal: espacamento.xl, paddingVertical: espacamento.lg, gap: espacamento.md },
  erro: { color: cores.red.padrao, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  erroInline: { fontSize: 11.5, color: cores.red.padrao },
  vazio: { textAlign: 'center', fontSize: 13.5, color: cores.stone[600] },
  tituloSecao: { fontSize: 15, fontWeight: '800', color: cores.stone[900] },
  subtituloSecao: { fontSize: 11.5, color: cores.stone[400] },
  sugestao: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm + 2,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  sugestaoFechar: { position: 'absolute', right: 8, top: 8 },
  sugestaoIcone: {
    width: 36,
    height: 36,
    borderRadius: raio.sm + 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sugestaoTitulo: { fontSize: 13, fontWeight: '800', color: '#5a3f0e' },
  sugestaoSub: { fontSize: 11.5, color: cores.amber.padrao, marginTop: 2, marginBottom: espacamento.sm },
  sugestaoBotao: {
    alignSelf: 'flex-start',
    backgroundColor: cores.green[700],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.xs + 2,
  },
  sugestaoBotaoTexto: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  cardRegra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  cardRegraIcone: {
    width: 38,
    height: 38,
    borderRadius: raio.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRegraTitulo: { fontSize: 13.5, fontWeight: '700', color: cores.stone[900] },
  cardRegraTags: { flexDirection: 'row', flexWrap: 'wrap', gap: espacamento.xs, marginTop: 4 },
  badgeGatilho: { fontSize: 10, fontWeight: '700', borderRadius: raio.pill, paddingHorizontal: espacamento.sm - 2, paddingVertical: 2 },
  badgeGatilhoVenda: { color: cores.green[600], backgroundColor: cores.green[100] },
  badgeGatilhoPeriodo: { color: cores.amber.padrao, backgroundColor: cores.amber.fundo },
  badgeRateio: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.stone[600],
    backgroundColor: cores.cream[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm - 2,
    paddingVertical: 2,
  },
  botaoAdicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
  },
  botaoAdicionarTexto: { fontSize: 13.5, fontWeight: '700', color: cores.green[700] },
  formNova: {
    gap: espacamento.md,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  label: { fontSize: 12, fontWeight: '700', color: cores.green[700], marginBottom: espacamento.sm },
  linhaChips: { flexDirection: 'row', gap: espacamento.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
    backgroundColor: '#FFFFFF',
  },
  chipAtivo: { borderColor: cores.green[800], backgroundColor: cores.green[800] },
  chipTexto: { fontSize: 12.5, fontWeight: '700', color: cores.stone[700] },
  chipTextoAtivo: { color: '#FFFFFF' },
  valorLinha: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacamento.xs + 2,
    borderBottomWidth: 2,
    borderBottomColor: cores.linha,
    paddingVertical: espacamento.sm + 4,
  },
  valorPrefixo: { fontSize: 18, fontWeight: '700', color: cores.stone[400] },
  valorInput: { minWidth: 120, fontSize: 22, fontWeight: '800', color: cores.stone[900], padding: 0 },
  opcaoRateio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.sm + 4,
    backgroundColor: '#FFFFFF',
  },
  opcaoRateioAtiva: { borderColor: cores.green[700], backgroundColor: cores.green[100] },
  opcaoRateioTitulo: { flex: 1, fontSize: 13, fontWeight: '700', color: cores.stone[900] },
  blocoRateio: {
    marginTop: espacamento.sm + 2,
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.green[100],
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  badgeSoma: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.xs + 2,
  },
  badgeSomaOk: { color: cores.green[700], backgroundColor: cores.green[100] },
  badgeSomaErro: { color: cores.red.padrao, backgroundColor: cores.red.fundo },
  linhaPercentual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm,
    gap: espacamento.sm,
  },
  linhaPercentualNome: { flex: 1, fontSize: 13, fontWeight: '700', color: cores.stone[900] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: espacamento.sm },
  stepperBotao: {
    width: 25,
    height: 25,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSinal: { fontSize: 15, fontWeight: '700', color: cores.green[800] },
  stepperValor: { minWidth: 34, textAlign: 'center', fontSize: 14, fontWeight: '800', color: cores.stone[900] },
  linhaBotoes: { flexDirection: 'row', gap: espacamento.sm },
  botaoSecundario: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 4,
    alignItems: 'center',
  },
  botaoSecundarioTexto: { fontSize: 13, fontWeight: '700', color: cores.stone[700] },
  botaoPrimario: {
    flex: 1,
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 4,
    alignItems: 'center',
    backgroundColor: cores.green[800],
  },
  botaoDesabilitado: { opacity: 0.5 },
  textoBotaoPrimario: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
