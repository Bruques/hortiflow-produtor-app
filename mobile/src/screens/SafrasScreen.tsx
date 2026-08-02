import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Pencil, Plus, Sprout } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { atualizarObservacoesRequest, encerrarSafraRequest, listarSafrasRequest } from '../services/safras';
import { obterSafrasCache, salvarSafrasCache } from '../lib/safrasCache';
import { mensagemErro } from '../lib/erroApi';
import { useSafraAtiva } from '../context/SafraContext';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { formatarData } from '../lib/data';
import { ROTULO_STATUS_SAFRA } from '../lib/rotulos';
import { cores, espacamento, raio } from '../theme';
import type { Safra } from '../types/safra';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Safras'>;

// Equivalente à frontend/src/pages/SafrasPage.tsx do web (lá alcançada via Menu → "Abrir
// nova safra"; aqui, até a spec `08` trazer o Menu de verdade, vem da tela placeholder de
// dentro da safra — docs/specs/mobile/03-safra.md).
export function SafrasScreen({ navigation }: Props) {
  const { safraAtiva, selecionarSafra } = useSafraAtiva();
  const sociedadeId = safraAtiva?.sociedadeId;

  const [safras, setSafras] = useState<Safra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [salvandoObsId, setSalvandoObsId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!sociedadeId) return;
    const cache = await obterSafrasCache(sociedadeId);
    if (cache.length > 0) {
      setSafras(cache);
      setCarregando(false);
    }

    try {
      const { safras: atualizadas } = await listarSafrasRequest(sociedadeId);
      setSafras(atualizadas);
      setErro(null);
      await salvarSafrasCache(sociedadeId, atualizadas);
    } catch {
      if (cache.length === 0) {
        setErro('Não foi possível carregar as safras');
      }
    } finally {
      setCarregando(false);
    }
  }, [sociedadeId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirEdicaoObs(safra: Safra) {
    setEditandoId(safra.id);
    setTextoEdicao(safra.observacoes ?? '');
  }

  async function salvarObs(safraId: string) {
    setSalvandoObsId(safraId);
    try {
      await atualizarObservacoesRequest(safraId, textoEdicao.trim() || null);
      setEditandoId(null);
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível salvar as observações'));
    } finally {
      setSalvandoObsId(null);
    }
  }

  async function encerrar(safraId: string) {
    setErro(null);
    setEncerrandoId(safraId);
    try {
      await encerrarSafraRequest(safraId);
      await carregar();
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível encerrar a safra'));
    } finally {
      setEncerrandoId(null);
    }
  }

  function abrirSafra(safra: Safra) {
    if (!sociedadeId) return;
    selecionarSafra({ safraId: safra.id, sociedadeId, safra });
    navigation.replace('Safra');
  }

  if (!safraAtiva) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <View style={styles.centralizado}>
          <Text style={styles.subtitulo}>Nenhuma sociedade selecionada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Safras</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <View style={styles.conteudo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && safras.length === 0 && <ActivityIndicator />}
        {!carregando && safras.length === 0 && <Text style={styles.subtitulo}>Nenhuma safra ainda.</Text>}

        <View style={styles.lista}>
          {safras.map((s) => {
            const encerrada = s.status === 'ENCERRADA';
            return (
              <View key={s.id}>
                <Pressable style={styles.cartao} onPress={() => abrirSafra(s)}>
                  <View style={[styles.iconeSafra, encerrada && styles.iconeSafraEncerrada]}>
                    <Sprout size={20} color={encerrada ? cores.stone[400] : cores.green[700]} />
                  </View>
                  <View style={styles.cartaoTextos}>
                    <Text style={styles.cartaoNome} numberOfLines={1}>
                      {s.nome}
                    </Text>
                    <Text style={styles.cartaoData}>
                      {s.data_inicio && s.data_fim
                        ? `${formatarData(s.data_inicio)} – ${formatarData(s.data_fim)}`
                        : s.data_inicio
                          ? `Aberta em ${formatarData(s.data_inicio)}`
                          : ''}
                    </Text>
                    {s.observacoes && (
                      <Text style={styles.cartaoObs} numberOfLines={1}>
                        {s.observacoes}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.badgeStatus, encerrada && styles.badgeStatusEncerrada]}>
                    {ROTULO_STATUS_SAFRA[s.status]}
                  </Text>
                  <ChevronRight size={16} color={cores.stone[400]} />
                </Pressable>

                {editandoId === s.id ? (
                  <View style={styles.cartaoEdicao}>
                    <TextInput
                      style={styles.inputObs}
                      value={textoEdicao}
                      onChangeText={setTextoEdicao}
                      maxLength={500}
                      multiline
                      numberOfLines={2}
                    />
                    <View style={styles.acoesEdicao}>
                      <Pressable style={styles.botaoCancelar} onPress={() => setEditandoId(null)}>
                        <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        style={styles.botaoConfirmar}
                        onPress={() => salvarObs(s.id)}
                        disabled={salvandoObsId === s.id}
                      >
                        {salvandoObsId === s.id ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.textoBotaoConfirmar}>Salvar</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.acoesLinha}>
                    <Pressable onPress={() => abrirEdicaoObs(s)} style={styles.acaoTexto}>
                      <Pencil size={12} color={cores.stone[600]} />
                      <Text style={styles.acaoTextoLabel}>Editar observações</Text>
                    </Pressable>
                    {s.status === 'EM_ANDAMENTO' && (
                      <Pressable onPress={() => encerrar(s.id)} disabled={encerrandoId === s.id}>
                        <Text style={styles.acaoTextoLabel}>
                          {encerrandoId === s.id ? 'Encerrando...' : 'Encerrar esta safra'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.rodape}>
        <Pressable style={styles.botaoPrimario} onPress={() => navigation.navigate('NovaSafra')}>
          <Plus size={17} color="#FFFFFF" />
          <Text style={styles.textoBotaoPrimario}>Nova safra</Text>
        </Pressable>
      </View>
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
    flex: 1,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
    gap: espacamento.md,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  subtitulo: {
    fontSize: 14,
    color: cores.stone[600],
    textAlign: 'center',
  },
  lista: {
    gap: espacamento.sm,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    backgroundColor: '#FFFFFF',
    padding: espacamento.sm + 6,
  },
  iconeSafra: {
    width: 42,
    height: 42,
    borderRadius: raio.md,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeSafraEncerrada: {
    backgroundColor: cores.cream[100],
  },
  cartaoTextos: {
    flex: 1,
    minWidth: 0,
  },
  cartaoNome: {
    fontSize: 14.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  cartaoData: {
    fontSize: 11.5,
    color: cores.stone[600],
    marginTop: 2,
  },
  cartaoObs: {
    fontSize: 11.5,
    color: cores.stone[400],
    marginTop: 2,
  },
  badgeStatus: {
    fontSize: 10.5,
    fontWeight: '800',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: espacamento.xs,
  },
  badgeStatusEncerrada: {
    color: cores.stone[600],
    backgroundColor: cores.cream[100],
  },
  cartaoEdicao: {
    marginTop: espacamento.sm,
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    backgroundColor: '#FFFFFF',
    padding: espacamento.sm + 4,
  },
  inputObs: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.sm + 4,
    paddingVertical: espacamento.sm,
    fontSize: 13,
    color: cores.stone[900],
    textAlignVertical: 'top',
  },
  acoesEdicao: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  botaoCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm,
    alignItems: 'center',
  },
  textoBotaoCancelar: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  botaoConfirmar: {
    flex: 1,
    backgroundColor: cores.green[800],
    borderRadius: raio.md,
    paddingVertical: espacamento.sm,
    alignItems: 'center',
  },
  textoBotaoConfirmar: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  acoesLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.md,
    marginTop: espacamento.xs + 2,
  },
  acaoTexto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs,
  },
  acaoTextoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: cores.stone[600],
    textDecorationLine: 'underline',
  },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: cores.cream[100],
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
  },
  botaoPrimario: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.sm,
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
    backgroundColor: cores.green[800],
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
