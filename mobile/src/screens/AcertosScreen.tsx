import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listarAcertosRequest } from '../services/acertos';
import { obterAcertosCache, salvarAcertosCache } from '../lib/acertosCache';
import { useConectividade } from '../lib/useConectividade';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { formatarData, formatarHora } from '../lib/data';
import { cores, espacamento, raio } from '../theme';
import type { AcertoResumo } from '../types/acerto';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Acertos'>;

// Histórico de Acertos da safra, equivalente à frontend/src/pages/AcertosPage.tsx do web —
// sem o cálculo de "lucro ainda não dividido" (não é um critério de aceite da spec `05`
// mobile, e dependeria de mais uma chamada de simulação personalizada só pra esse número).
// Alcançada via card do Menu (spec `08`) como uma página de detalhe empilhada — diferente do
// web (que embute Acertos dentro do mesmo layout com bottom nav de Resumo/Vendas/Despesas), o
// mobile mantém esta tela fora da casca de navegação, com seta de voltar própria: só as 4 abas
// de verdade (Resumo/Vendas/Despesas/Menu) vivem dentro do tab navigator — ver decisão
// registrada em docs/specs/mobile/08-navegacao-resumo-e-menu.md (2026-08-03).
export function AcertosScreen({ navigation, route }: Props) {
  const { safraId } = route.params;
  const conectado = useConectividade();

  const [acertos, setAcertos] = useState<AcertoResumo[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const cache = await obterAcertosCache(safraId);
    if (cache.atualizadoEm) {
      setAcertos(cache.acertos);
      setAtualizadoEm(cache.atualizadoEm);
      setCarregando(false);
    }

    try {
      const atualizados = await listarAcertosRequest(safraId);
      const novoAtualizadoEm = await salvarAcertosCache(safraId, atualizados);
      setAcertos(atualizados);
      setAtualizadoEm(novoAtualizadoEm);
      setErro(null);
    } catch {
      if (!cache.atualizadoEm) setErro('Não foi possível carregar os acertos');
    } finally {
      setCarregando(false);
    }
  }, [safraId]);

  useEffect(() => {
    const desinscrever = navigation.addListener('focus', carregar);
    return desinscrever;
  }, [navigation, carregar]);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Acertos</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        <Pressable
          style={styles.botaoNovo}
          onPress={() => navigation.navigate('NovoAcerto', { safraId })}
        >
          <FileText size={17} color="#FFFFFF" />
          <Text style={styles.textoBotaoNovo}>Registrar novo acerto</Text>
        </Pressable>

        {!conectado && atualizadoEm && (
          <Text style={styles.avisoOffline}>Atualizado às {formatarHora(atualizadoEm)} — sem conexão</Text>
        )}

        {erro && <Text style={styles.erro}>{erro}</Text>}
        {carregando && acertos.length === 0 && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}
        {!conectado && !atualizadoEm && !carregando && (
          <Text style={styles.vazio}>Nenhum dado salvo — conecte-se à internet para carregar os acertos.</Text>
        )}
        {!carregando && atualizadoEm && acertos.length === 0 && (
          <Text style={styles.vazio}>Nenhum acerto registrado ainda.</Text>
        )}

        {acertos.map((a) => (
          <Pressable
            key={a.id}
            style={styles.item}
            onPress={() => navigation.navigate('AcertoDetalhe', { acertoId: a.id, safraId })}
          >
            <View style={styles.itemTextos}>
              <Text style={[styles.badgeTipo, a.tipo === 'FINAL' ? styles.badgeFinal : styles.badgeParcial]}>
                {a.tipo === 'FINAL' ? 'Final' : 'Parcial'}
              </Text>
              <Text style={styles.itemPeriodo}>
                {formatarData(a.data_inicio)} – {formatarData(a.data_fim)}
              </Text>
              <Text style={styles.itemRegistradoEm}>Registrado em {formatarData(a.criado_em)}</Text>
            </View>
            <ChevronRight size={18} color={cores.linha} />
          </Pressable>
        ))}
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
    gap: espacamento.sm + 2,
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
    fontSize: 13,
    fontWeight: '500',
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
    gap: espacamento.sm,
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 4,
  },
  itemTextos: {
    flex: 1,
  },
  badgeTipo: {
    alignSelf: 'flex-start',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: 2,
  },
  badgeFinal: {
    backgroundColor: cores.green[800],
    color: '#FFFFFF',
  },
  badgeParcial: {
    backgroundColor: cores.blue.fundo,
    color: cores.blue.padrao,
  },
  itemPeriodo: {
    marginTop: espacamento.xs + 2,
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  itemRegistradoEm: {
    marginTop: 1,
    fontSize: 11,
    color: cores.stone[400],
  },
});
