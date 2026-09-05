import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, LogOut } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { criarSociedadeRequest } from '../services/sociedades';
import { listarMinhasSafrasRequest } from '../services/safras';
import { obterMinhasSafrasCache, salvarMinhasSafrasCache } from '../lib/safrasCache';
import { abrirSafraRequest } from '../services/safras';
import { buscarResumoConsolidadoRequest } from '../services/simulacao';
import { mensagemErro } from '../lib/erroApi';
import { formatarMoeda } from '../lib/formatacao';
import { useSafraAtiva } from '../context/SafraContext';
import { useAuth } from '../context/AuthContext';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { BrandLockup } from '../components/BrandMark';
import { PeriodToggle } from '../components/PeriodToggle';
import { ROTULO_STATUS_SAFRA } from '../lib/rotulos';
import { cores, espacamento, raio } from '../theme';
import type { MinhaSafra } from '../types/safra';
import type { PeriodoFiltro, ResumoConsolidado } from '../types/simulacao';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Inicio'>;

// Tela de entrada pós-login, equivalente à HomePage do web (frontend/src/pages/HomePage.tsx):
// pensa em Safra, não em Sociedade. 0 safras → formulário que já cria propriedade+safra
// juntas; 1 safra → entra direto nela; 2+ → lista pra escolher (docs/specs/mobile/03-safra.md).
export function InicioScreen({ navigation }: Props) {
  const { usuario, sair } = useAuth();
  const { selecionarSafra } = useSafraAtiva();

  const [safras, setSafras] = useState<MinhaSafra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [nomePropriedade, setNomePropriedade] = useState('');
  const [nomeSafra, setNomeSafra] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);
  // Guarda além do estado `criando`: um duplo toque rápido dispara os dois onPress antes do
  // primeiro re-render desabilitar o botão (state não é síncrono), o que criava uma sociedade
  // duplicada por toque extra (bug relatado 2026-08-26). Uma ref muda no mesmo instante do
  // clique, sem esperar re-render, então bloqueia a segunda chamada de verdade.
  const criandoRef = useRef(false);

  // Resumo consolidado ("quanto eu recebo somando todas as safras ativas") — mesmo padrão
  // do web (HomePage.tsx), só faz sentido buscar com 2+ safras; com 1 só, o usuário já é
  // redirecionado direto pra ela (docs/specs/11-resumo-consolidado-e-despesa-compartilhada.md).
  const [periodoResumo, setPeriodoResumo] = useState<PeriodoFiltro>('mes');
  const [resumo, setResumo] = useState<ResumoConsolidado | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  const carregar = useCallback(async () => {
    const cache = await obterMinhasSafrasCache();
    if (cache.length > 0) {
      setSafras(cache);
      setCarregando(false);
    }

    try {
      const { safras: atualizadas } = await listarMinhasSafrasRequest();
      setSafras(atualizadas);
      setErro(null);
      await salvarMinhasSafrasCache(atualizadas);
    } catch {
      if (cache.length === 0) {
        setErro('Não foi possível carregar suas safras');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!carregando && !erro && safras.length === 1) {
      entrarNaSafra(safras[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, erro, safras]);

  const carregarResumo = useCallback(async () => {
    if (safras.length < 2) return;
    setCarregandoResumo(true);
    try {
      setResumo(await buscarResumoConsolidadoRequest(periodoResumo));
    } catch {
      setResumo(null);
    } finally {
      setCarregandoResumo(false);
    }
  }, [safras.length, periodoResumo]);

  useEffect(() => {
    carregarResumo();
  }, [carregarResumo]);

  const [refrescando, setRefrescando] = useState(false);

  async function aoArrastar() {
    setRefrescando(true);
    await Promise.all([carregar(), carregarResumo()]);
    setRefrescando(false);
  }

  function entrarNaSafra(safra: MinhaSafra) {
    selecionarSafra({ safraId: safra.id, sociedadeId: safra.sociedade_id, safra });
    navigation.replace('Safra');
  }

  async function criarPrimeiraSafra() {
    if (!nomePropriedade.trim() || !nomeSafra.trim() || criandoRef.current) return;
    criandoRef.current = true;
    setErroCriacao(null);
    setCriando(true);
    try {
      const { sociedade } = await criarSociedadeRequest(nomePropriedade.trim());
      const { safra } = await abrirSafraRequest(sociedade.id, nomeSafra.trim());
      selecionarSafra({ safraId: safra.id, sociedadeId: sociedade.id, safra });
      navigation.replace('Safra');
    } catch (err) {
      setErroCriacao(mensagemErro(err, 'Não foi possível criar a safra'));
      criandoRef.current = false;
      setCriando(false);
    }
  }

  if (carregando && safras.length === 0) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <View style={styles.centralizado}>
          <BrandLockup />
        </View>
      </SafeAreaView>
    );
  }

  if (erro && safras.length === 0) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <View style={styles.centralizado}>
          <Text style={styles.erro}>{erro}</Text>
          <Pressable style={styles.botaoSecundario} onPress={carregar}>
            <Text style={styles.textoBotaoSecundario}>Tentar de novo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (safras.length === 0) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <BannerSemConexao />
        <View style={styles.conteudo}>
          <View style={styles.marca}>
            <BrandLockup />
          </View>

          <View>
            <Text style={styles.titulo}>{usuario ? `Bem-vindo, ${usuario.nome.split(' ')[0]}!` : 'Vamos começar'}</Text>
            <Text style={styles.subtitulo}>
              Comece cadastrando a sua propriedade e a safra atual. Depois, se quiser, você convida um
              meeiro pra dividir a produção com você.
            </Text>
          </View>

          <View style={styles.cartaoForm}>
            <View>
              <Text style={styles.label}>Nome da propriedade</Text>
              <TextInput
                style={styles.input}
                placeholder="Sítio Boa Vista"
                placeholderTextColor={cores.stone[400]}
                value={nomePropriedade}
                onChangeText={setNomePropriedade}
              />
            </View>
            <View>
              <Text style={styles.label}>Nome da safra</Text>
              <TextInput
                style={styles.input}
                placeholder="Safra 2026"
                placeholderTextColor={cores.stone[400]}
                value={nomeSafra}
                onChangeText={setNomeSafra}
              />
            </View>

            {erroCriacao && <Text style={styles.erro}>{erroCriacao}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.botaoPrimario,
                (!nomePropriedade.trim() || !nomeSafra.trim()) && styles.botaoDesabilitado,
                pressed && styles.botaoPressionado,
              ]}
              onPress={criarPrimeiraSafra}
              disabled={!nomePropriedade.trim() || !nomeSafra.trim() || criando}
            >
              {criando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.textoBotaoPrimario}>Começar</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => navigation.navigate('EntrarSociedade')}>
            <Text style={styles.linkCentralizado}>Já tenho um código de convite</Text>
          </Pressable>

          <Pressable style={styles.linkSair} onPress={() => sair()}>
            <LogOut size={16} color={cores.stone[600]} />
            <Text style={styles.linkSairTexto}>Sair</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.conteudo}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={aoArrastar} tintColor={cores.green[700]} />}
      >
        <View>
          <Text style={styles.tituloLista}>{usuario ? `Olá, ${usuario.nome.split(' ')[0]}` : 'Suas safras'}</Text>
          <Text style={styles.subtituloLista}>Escolha uma safra pra continuar</Text>
        </View>

        <View style={styles.cartaoResumo}>
          <Text style={styles.resumoLabel}>Você recebe (estimado) · todas as safras ativas</Text>
          <Text style={styles.resumoValor}>
            {carregandoResumo && !resumo ? '...' : formatarMoeda(resumo?.totalReceber ?? 0)}
          </Text>
          <View style={styles.filtroResumo}>
            <PeriodToggle valor={periodoResumo} onSelecionar={setPeriodoResumo} />
          </View>
          <Pressable onPress={() => navigation.navigate('DespesaCompartilhada')}>
            <Text style={styles.linkResumo}>Lançar despesa compartilhada entre safras</Text>
          </Pressable>
        </View>

        <View style={styles.lista}>
          {safras.map((s) => (
            <Pressable key={s.id} style={styles.cartaoSafra} onPress={() => entrarNaSafra(s)}>
              <View style={styles.cartaoSafraTextos}>
                <Text style={styles.cartaoSafraNome} numberOfLines={1}>
                  {s.nome}
                </Text>
                <Text style={styles.cartaoSafraSociedade} numberOfLines={1}>
                  {s.sociedade_nome}
                </Text>
              </View>
              <Text style={styles.badgeStatus}>{ROTULO_STATUS_SAFRA[s.status]}</Text>
              <ChevronRight size={16} color={cores.stone[400]} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.linkSair} onPress={() => sair()}>
          <LogOut size={16} color={cores.stone[600]} />
          <Text style={styles.linkSairTexto}>Sair</Text>
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
  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.md,
  },
  conteudo: {
    flex: 1,
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.lg,
    gap: espacamento.lg,
  },
  marca: {
    alignSelf: 'center',
  },
  titulo: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    color: cores.stone[900],
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: cores.stone[600],
    marginTop: espacamento.xs + 2,
  },
  cartaoForm: {
    gap: espacamento.sm + 2,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    backgroundColor: '#FFFFFF',
    padding: espacamento.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.xs + 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm + 4,
    fontSize: 15,
    color: cores.stone[900],
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  botaoPrimario: {
    marginTop: espacamento.xs,
    borderRadius: raio.md,
    paddingVertical: espacamento.md + 2,
    alignItems: 'center',
    backgroundColor: cores.green[800],
  },
  botaoPressionado: {
    backgroundColor: cores.green[900],
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  botaoSecundario: {
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  textoBotaoSecundario: {
    color: cores.green[700],
    fontSize: 14,
    fontWeight: '700',
  },
  linkCentralizado: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: cores.green[700],
  },
  linkSair: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    marginTop: espacamento.xs,
    paddingBottom: espacamento.md,
  },
  linkSairTexto: {
    fontSize: 14,
    color: cores.stone[600],
  },
  tituloLista: {
    fontSize: 19,
    fontWeight: '800',
    color: cores.stone[900],
  },
  subtituloLista: {
    fontSize: 13.5,
    color: cores.stone[600],
    marginTop: 2,
  },
  cartaoResumo: {
    gap: espacamento.sm + 2,
    borderRadius: raio.lg,
    backgroundColor: cores.green[900],
    padding: espacamento.lg,
  },
  resumoLabel: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.8)',
  },
  resumoValor: {
    marginTop: 2,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // PeriodToggle usa `flex: 1` internamente pensando numa linha (largura, não altura) — sem
  // este wrapper `row`, o flex:1 tentava crescer verticalmente dentro da coluna do card e
  // colapsava a altura do texto (bug relatado 2026-09-05: seletor aparecia sem nenhum texto).
  filtroResumo: {
    flexDirection: 'row',
  },
  linkResumo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },
  lista: {
    gap: espacamento.sm,
  },
  cartaoSafra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.lg,
    backgroundColor: '#FFFFFF',
  },
  cartaoSafraTextos: {
    flex: 1,
    minWidth: 0,
  },
  cartaoSafraNome: {
    fontSize: 14.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  cartaoSafraSociedade: {
    fontSize: 12.5,
    color: cores.stone[600],
    marginTop: 2,
  },
  badgeStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: espacamento.xs,
  },
});
