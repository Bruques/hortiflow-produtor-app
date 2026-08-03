import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { obterSociosCache } from '../lib/sociedadesCache';
import { listarSociosRequest } from '../services/sociedades';
import { atualizarAtivoUnidadeRequest, criarUnidadeRequest, listarUnidadesRequest } from '../services/unidadesVenda';
import { mensagemErro } from '../lib/erroApi';
import { cores, espacamento, raio } from '../theme';
import type { UnidadeVenda } from '../types/unidadeVenda';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'UnidadesVenda'>;

// Cadastro de unidades de venda — só sócio FINANCIADOR/MISTO. Equivalente à
// frontend/src/pages/ConfiguracoesUnidadesVendaPage.tsx do web. Ação rara que exige conexão
// (não entra na fila offline, ver docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
export function ConfiguracoesUnidadesVendaScreen({ navigation, route }: Props) {
  const { sociedadeId } = route.params;
  const { usuario } = useAuth();

  const [souFinanciador, setSouFinanciador] = useState(false);
  const [carregandoPapel, setCarregandoPapel] = useState(true);

  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [novaAberta, setNovaAberta] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregarUnidades() {
    setCarregando(true);
    try {
      const { unidades: atualizadas } = await listarUnidadesRequest(sociedadeId);
      setUnidades(atualizadas);
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível carregar as unidades de venda'));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarUnidades();
    (async () => {
      const cache = await obterSociosCache(sociedadeId);
      const euNoCache = cache.find((s) => s.usuario_id === usuario?.id);
      if (euNoCache) setSouFinanciador(euNoCache.papel === 'FINANCIADOR' || euNoCache.papel === 'MISTO');
      try {
        const { socios } = await listarSociosRequest(sociedadeId);
        const eu = socios.find((s) => s.usuario_id === usuario?.id);
        setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
      } catch {
        // offline: segue com o que o cache já indicava
      } finally {
        setCarregandoPapel(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId]);

  async function alternarAtivo(unidade: UnidadeVenda) {
    setErro(null);
    try {
      await atualizarAtivoUnidadeRequest(unidade.id, !unidade.ativo);
      await carregarUnidades();
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível atualizar a unidade'));
    }
  }

  async function adicionar() {
    if (!nomeNova.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarUnidadeRequest(sociedadeId, nomeNova.trim());
      setNomeNova('');
      setNovaAberta(false);
      await carregarUnidades();
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível criar a unidade'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Unidades de venda</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {!carregandoPapel && !souFinanciador && (
          <Text style={styles.aviso}>Apenas o financiador cadastra ou desativa unidades.</Text>
        )}

        {carregando && unidades.length === 0 && <ActivityIndicator />}

        {unidades.map((u) => (
          <View key={u.id} style={styles.linha}>
            <Text style={styles.linhaNome}>{u.nome}</Text>
            <Switch
              value={u.ativo}
              onValueChange={() => alternarAtivo(u)}
              disabled={!souFinanciador}
              trackColor={{ false: cores.cream[100], true: cores.green[700] }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}

        {!carregando && unidades.length === 0 && <Text style={styles.vazio}>Nenhuma unidade cadastrada ainda.</Text>}

        {souFinanciador && !novaAberta && (
          <Pressable style={styles.botaoAdicionar} onPress={() => setNovaAberta(true)}>
            <Plus size={16} color={cores.green[700]} />
            <Text style={styles.botaoAdicionarTexto}>Nova unidade</Text>
          </Pressable>
        )}

        {souFinanciador && novaAberta && (
          <View style={styles.formNova}>
            <Text style={styles.label}>Nome da unidade</Text>
            <TextInput
              style={styles.input}
              value={nomeNova}
              onChangeText={setNomeNova}
              placeholder="Ex: Kg"
              placeholderTextColor={cores.stone[400]}
            />
            <View style={styles.linhaBotoes}>
              <Pressable style={styles.botaoSecundario} onPress={() => setNovaAberta(false)}>
                <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.botaoPrimario, (salvando || !nomeNova.trim()) && styles.botaoDesabilitado]}
                onPress={adicionar}
                disabled={salvando || !nomeNova.trim()}
              >
                <Text style={styles.textoBotaoPrimario}>{salvando ? 'Adicionando...' : 'Adicionar'}</Text>
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
  aviso: { fontSize: 12.5, color: cores.stone[600], textAlign: 'center' },
  vazio: { textAlign: 'center', fontSize: 13.5, color: cores.stone[600] },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 2,
  },
  linhaNome: { fontSize: 13.5, fontWeight: '700', color: cores.stone[900] },
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
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  label: { fontSize: 12, fontWeight: '700', color: cores.green[700] },
  input: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    fontSize: 13.5,
    color: cores.stone[900],
    backgroundColor: '#FFFFFF',
  },
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
