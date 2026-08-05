import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, Check, Minus, Plus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  atualizarPercentuaisRequest,
  criarSocioRequest,
  listarSociedadesRequest,
  listarSociosRequest,
} from '../services/sociedades';
import { obterSociosCache, salvarSociosCache } from '../lib/sociedadesCache';
import { mensagemErro } from '../lib/erroApi';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { cores, espacamento, raio } from '../theme';
import type { PapelSocio, Socio } from '../types/sociedade';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Socios'>;

const CORES_BARRA = [cores.green[800], cores.green[600], cores.amber.padrao, cores.blue.padrao];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

const ROTULO_PAPEL: Record<PapelSocio, string> = {
  FINANCIADOR: 'Financiador',
  MEEIRO: 'Meeiro',
  MISTO: 'Misto',
};

// Edição de percentuais e cadastro de sócio sem conta, equivalente à
// frontend/src/pages/ConfiguracoesSociosPage.tsx do web (alcançada lá via Menu → "Sócios e
// Sociedade"). `sociedadeId` chega por parâmetro de rota (docs/specs/mobile/03-safra.md) —
// nome e código de convite não vêm junto (a lista de sócios não devolve isso), então são
// buscados à parte via `listarSociedadesRequest`, mesmo padrão do web.
export function SociosScreen({ navigation, route }: Props) {
  const { sociedadeId } = route.params;
  const [nomeSociedade, setNomeSociedade] = useState<string | null>(null);
  const [codigoConvite, setCodigoConvite] = useState<string | null>(null);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [salvandoPct, setSalvandoPct] = useState(false);
  const [erroPct, setErroPct] = useState<string | null>(null);
  const [sucessoPct, setSucessoPct] = useState(false);

  const [novoSocioAberto, setNovoSocioAberto] = useState(false);
  const [nomeNovoSocio, setNomeNovoSocio] = useState('');
  const [papelNovoSocio, setPapelNovoSocio] = useState<PapelSocio>('MEEIRO');
  const [salvandoNovoSocio, setSalvandoNovoSocio] = useState(false);

  const carregar = useCallback(async () => {
    const cache = await obterSociosCache(sociedadeId);
    if (cache.length > 0) {
      setSocios(cache);
      setCarregando(false);
    }

    try {
      const { socios: atualizados } = await listarSociosRequest(sociedadeId);
      setSocios(atualizados);
      setErroCarregar(null);
      await salvarSociosCache(sociedadeId, atualizados);
    } catch {
      if (cache.length === 0) {
        setErroCarregar('Não foi possível carregar os sócios');
      }
    } finally {
      setCarregando(false);
    }
  }, [sociedadeId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    listarSociedadesRequest()
      .then((res) => {
        const minha = res.sociedades.find((s) => s.id === sociedadeId);
        setNomeSociedade(minha?.nome ?? null);
        setCodigoConvite(minha?.codigo_convite ?? null);
      })
      .catch(() => {});
  }, [sociedadeId]);

  function ajustarPct(socioId: string, delta: number) {
    setSucessoPct(false);
    setSocios((atual) =>
      atual.map((s) =>
        s.id === socioId
          ? { ...s, percentual_lucro: String(Math.max(0, Math.min(100, Number(s.percentual_lucro) + delta))) }
          : s
      )
    );
  }

  const somaPct = socios.reduce((acc, s) => acc + Number(s.percentual_lucro), 0);
  const pctOk = Math.abs(somaPct - 100) < 0.01;

  async function salvarPercentuais() {
    setErroPct(null);
    setSucessoPct(false);
    setSalvandoPct(true);
    try {
      const { socios: atualizados } = await atualizarPercentuaisRequest(
        sociedadeId,
        socios.map((s) => ({ id: s.id, percentual_lucro: Number(s.percentual_lucro), papel: s.papel }))
      );
      setSocios(atualizados);
      await salvarSociosCache(sociedadeId, atualizados);
      setSucessoPct(true);
    } catch (err) {
      setErroPct(mensagemErro(err, 'Não foi possível salvar os percentuais'));
    } finally {
      setSalvandoPct(false);
    }
  }

  async function adicionarSocio() {
    if (!nomeNovoSocio.trim()) return;
    setErroPct(null);
    setSalvandoNovoSocio(true);
    try {
      await criarSocioRequest(sociedadeId, nomeNovoSocio.trim(), papelNovoSocio);
      setNomeNovoSocio('');
      setPapelNovoSocio('MEEIRO');
      setNovoSocioAberto(false);
      await carregar();
    } catch (err) {
      setErroPct(mensagemErro(err, 'Não foi possível adicionar o sócio'));
    } finally {
      setSalvandoNovoSocio(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <TelaComTeclado>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho} numberOfLines={1}>
          {nomeSociedade ?? 'Sócios'}
        </Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.titulo}>Percentual de lucro</Text>
          <Text style={styles.legenda}>A soma precisa fechar em 100%</Text>
        </View>

        {carregando && socios.length === 0 && <ActivityIndicator />}
        {erroCarregar && socios.length === 0 && <Text style={styles.erro}>{erroCarregar}</Text>}

        {socios.length > 0 && (
          <>
            <View style={styles.barra}>
              {socios.map((s, i) => (
                <View
                  key={s.id}
                  style={{ width: `${Number(s.percentual_lucro)}%`, backgroundColor: CORES_BARRA[i % CORES_BARRA.length] }}
                />
              ))}
            </View>

            <View style={[styles.badgeSoma, pctOk ? styles.badgeSomaOk : styles.badgeSomaErro]}>
              {pctOk ? (
                <Check size={14} color={cores.green[700]} strokeWidth={3} />
              ) : (
                <AlertTriangle size={14} color={cores.red.padrao} />
              )}
              <Text style={[styles.badgeSomaTexto, { color: pctOk ? cores.green[700] : cores.red.padrao }]}>
                Total: {somaPct}%
              </Text>
            </View>

            <View style={styles.listaSocios}>
              {socios.map((s) => (
                <View key={s.id} style={styles.linhaSocio}>
                  <View style={styles.linhaSocioInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTexto}>{iniciais(s.nome)}</Text>
                    </View>
                    <View style={styles.linhaSocioTextos}>
                      <Text style={styles.linhaSocioNome} numberOfLines={1}>
                        {s.nome}
                      </Text>
                      <View style={styles.tags}>
                        <Text style={styles.tagPapel}>{ROTULO_PAPEL[s.papel]}</Text>
                        {!s.usuario_id && <Text style={styles.tagSemConta}>Sem conta</Text>}
                      </View>
                    </View>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepperBotao}
                      onPress={() => ajustarPct(s.id, -5)}
                      hitSlop={6}
                      accessibilityLabel={`Diminuir percentual de ${s.nome}`}
                    >
                      <Minus size={14} color={cores.green[800]} />
                    </Pressable>
                    <Text style={styles.stepperValor}>{Number(s.percentual_lucro)}%</Text>
                    <Pressable
                      style={styles.stepperBotao}
                      onPress={() => ajustarPct(s.id, 5)}
                      hitSlop={6}
                      accessibilityLabel={`Aumentar percentual de ${s.nome}`}
                    >
                      <Plus size={14} color={cores.green[800]} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {!novoSocioAberto && (
          <Pressable style={styles.botaoAdicionar} onPress={() => setNovoSocioAberto(true)}>
            <Plus size={16} color={cores.green[700]} />
            <Text style={styles.textoBotaoAdicionar}>Adicionar sócio</Text>
          </Pressable>
        )}

        {novoSocioAberto && (
          <View style={styles.cartaoNovoSocio}>
            <View>
              <Text style={styles.label}>Nome do sócio</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: João"
                placeholderTextColor={cores.stone[400]}
                value={nomeNovoSocio}
                onChangeText={setNomeNovoSocio}
              />
            </View>
            <View>
              <Text style={styles.label}>Papel</Text>
              <View style={styles.opcoesPapel}>
                {(['MEEIRO', 'FINANCIADOR', 'MISTO'] as PapelSocio[]).map((papel) => (
                  <Pressable
                    key={papel}
                    style={[styles.opcaoPapel, papelNovoSocio === papel && styles.opcaoPapelSelecionada]}
                    onPress={() => setPapelNovoSocio(papel)}
                  >
                    <Text
                      style={[
                        styles.opcaoPapelTexto,
                        papelNovoSocio === papel && styles.opcaoPapelTextoSelecionada,
                      ]}
                    >
                      {ROTULO_PAPEL[papel]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Text style={styles.legenda}>Entra com 0% — ajuste o percentual de todos depois de adicionar.</Text>
            <View style={styles.acoesNovoSocio}>
              <Pressable
                style={styles.botaoCancelar}
                onPress={() => setNovoSocioAberto(false)}
                disabled={salvandoNovoSocio}
              >
                <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.botaoConfirmar, !nomeNovoSocio.trim() && styles.botaoDesabilitado]}
                onPress={adicionarSocio}
                disabled={salvandoNovoSocio || !nomeNovoSocio.trim()}
              >
                {salvandoNovoSocio ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.textoBotaoConfirmar}>Adicionar</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {erroPct && <Text style={styles.erro}>{erroPct}</Text>}
        {sucessoPct && <Text style={styles.sucesso}>Percentuais atualizados!</Text>}

        {codigoConvite && (
          <View style={styles.codigoConvite}>
            <Text style={styles.codigoTexto}>
              {codigoConvite.slice(0, 3)} {codigoConvite.slice(3)}
            </Text>
            <Text style={styles.codigoLegenda}>Código para um novo sócio entrar na sociedade</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.rodapeAcao}>
        <Pressable
          style={[styles.botaoPrimario, (salvandoPct || socios.length === 0) && styles.botaoDesabilitado]}
          onPress={salvarPercentuais}
          disabled={salvandoPct || socios.length === 0}
        >
          {salvandoPct ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoPrimario}>Salvar alterações</Text>
          )}
        </Pressable>
      </View>
      </TelaComTeclado>
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
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  conteudo: {
    flexGrow: 1,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.md,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
  },
  legenda: {
    fontSize: 12,
    color: cores.stone[400],
    marginTop: 2,
  },
  subtitulo: {
    fontSize: 14,
    color: cores.stone[600],
    textAlign: 'center',
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  sucesso: {
    color: cores.green[700],
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  barra: {
    flexDirection: 'row',
    height: 14,
    borderRadius: raio.pill,
    overflow: 'hidden',
    backgroundColor: cores.cream[100],
  },
  badgeSoma: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: espacamento.xs,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.xs + 2,
  },
  badgeSomaOk: {
    backgroundColor: cores.green[100],
  },
  badgeSomaErro: {
    backgroundColor: cores.red.fundo,
  },
  badgeSomaTexto: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  listaSocios: {
    gap: espacamento.xs,
  },
  linhaSocio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 4,
    gap: espacamento.sm,
  },
  linhaSocioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    flex: 1,
    minWidth: 0,
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
    fontSize: 13,
    fontWeight: '800',
    color: cores.green[800],
  },
  linhaSocioTextos: {
    flex: 1,
    minWidth: 0,
  },
  linhaSocioNome: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.stone[900],
  },
  tags: {
    flexDirection: 'row',
    gap: espacamento.xs,
    marginTop: 2,
  },
  tagPapel: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.xs + 2,
    paddingVertical: 2,
  },
  tagSemConta: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.stone[400],
    backgroundColor: cores.cream[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.xs + 2,
    paddingVertical: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
  },
  stepperBotao: {
    width: 27,
    height: 27,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValor: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
  },
  botaoAdicionar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
  },
  textoBotaoAdicionar: {
    color: cores.green[700],
    fontWeight: '700',
    fontSize: 13.5,
  },
  cartaoNovoSocio: {
    gap: espacamento.sm + 2,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.xs + 2,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    fontSize: 15,
    color: cores.stone[900],
  },
  opcoesPapel: {
    flexDirection: 'row',
    gap: espacamento.xs,
  },
  opcaoPapel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm,
    alignItems: 'center',
  },
  opcaoPapelSelecionada: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  opcaoPapelTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  opcaoPapelTextoSelecionada: {
    color: cores.green[800],
  },
  acoesNovoSocio: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  botaoCancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 2,
    alignItems: 'center',
  },
  textoBotaoCancelar: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[600],
  },
  botaoConfirmar: {
    flex: 1,
    backgroundColor: cores.green[800],
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 2,
    alignItems: 'center',
  },
  textoBotaoConfirmar: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  codigoConvite: {
    backgroundColor: cores.cream[100],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md + 2,
  },
  codigoTexto: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
    color: cores.stone[900],
  },
  codigoLegenda: {
    fontSize: 11,
    color: cores.stone[400],
    marginTop: 2,
  },
  rodapeAcao: {
    borderTopWidth: 1,
    borderTopColor: cores.cream[100],
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
  },
  botaoPrimario: {
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
    alignItems: 'center',
    backgroundColor: cores.green[800],
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
