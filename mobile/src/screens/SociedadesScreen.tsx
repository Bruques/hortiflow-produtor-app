import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, KeyRound, Plus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listarSociedadesRequest } from '../services/sociedades';
import { obterSociedadesCache, salvarSociedadesCache } from '../lib/sociedadesCache';
import { useSociedadeAtiva } from '../context/SociedadeContext';
import { useAuth } from '../context/AuthContext';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { BrandLockup } from '../components/BrandMark';
import { cores, espacamento, raio } from '../theme';
import type { Sociedade } from '../types/sociedade';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Sociedades'>;

// Hub pós-login (docs/specs/mobile/02-sociedade-e-socios.md), equivalente à lista de
// sociedades do web. Mostra o que está salvo localmente primeiro (mesmo offline) e busca
// atualização em background quando há conexão — padrão geral definido na spec 00.
export function SociedadesScreen({ navigation }: Props) {
  const { usuario, sair } = useAuth();
  const { selecionarSociedade } = useSociedadeAtiva();
  const [sociedades, setSociedades] = useState<Sociedade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const cache = await obterSociedadesCache();
    if (cache.length > 0) {
      setSociedades(cache);
      setCarregando(false);
    }

    try {
      const { sociedades: atualizadas } = await listarSociedadesRequest();
      setSociedades(atualizadas);
      setErro(null);
      await salvarSociedadesCache(atualizadas);
    } catch {
      if (cache.length === 0) {
        setErro('Não foi possível carregar suas sociedades');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirSocios(sociedade: Sociedade) {
    selecionarSociedade(sociedade);
    navigation.navigate('Socios');
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.conteudo}>
        <View style={styles.marca}>
          <BrandLockup />
        </View>

        <Text style={styles.titulo}>
          {usuario ? `Olá, ${usuario.nome.split(' ')[0]}` : 'Minhas sociedades'}
        </Text>

        {carregando && sociedades.length === 0 && <ActivityIndicator style={styles.spinner} />}

        {erro && sociedades.length === 0 && (
          <View style={styles.estadoVazio}>
            <Text style={styles.erro}>{erro}</Text>
            <Pressable style={styles.botaoSecundario} onPress={carregar}>
              <Text style={styles.textoBotaoSecundario}>Tentar de novo</Text>
            </Pressable>
          </View>
        )}

        {!carregando && !erro && sociedades.length === 0 && (
          <View style={styles.estadoVazio}>
            <Text style={styles.subtitulo}>
              Você ainda não faz parte de nenhuma sociedade. Crie a sua ou entre com um código de convite.
            </Text>
          </View>
        )}

        {sociedades.length > 0 && (
          <View style={styles.lista}>
            {sociedades.map((s) => (
              <Pressable key={s.id} style={styles.cartao} onPress={() => abrirSocios(s)}>
                <View style={styles.cartaoTextos}>
                  <Text style={styles.cartaoNome}>{s.nome}</Text>
                  <Text style={styles.cartaoPapel}>
                    {s.papel === 'FINANCIADOR' ? 'Financiador' : s.papel === 'MEEIRO' ? 'Meeiro' : 'Misto'} ·{' '}
                    {Number(s.percentual_lucro)}%
                  </Text>
                </View>
                <ChevronRight size={18} color={cores.stone[400]} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.acoes}>
          <Pressable style={styles.botaoPrimario} onPress={() => navigation.navigate('CriarSociedade')}>
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.textoBotaoPrimario}>Criar sociedade</Text>
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={() => navigation.navigate('EntrarSociedade')}>
            <KeyRound size={18} color={cores.green[700]} />
            <Text style={styles.textoBotaoSecundario}>Entrar com código</Text>
          </Pressable>
        </View>

        <View style={styles.rodape}>
          <Pressable onPress={() => navigation.navigate('TrocaSenha')}>
            <Text style={styles.linkRodape}>Trocar senha</Text>
          </Pressable>
          <Pressable onPress={sair}>
            <Text style={styles.linkRodape}>Sair</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.cream[50],
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
    fontSize: 20,
    fontWeight: '800',
    color: cores.stone[900],
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
    color: cores.stone[600],
    textAlign: 'center',
  },
  spinner: {
    marginTop: espacamento.xl,
  },
  estadoVazio: {
    gap: espacamento.md,
    paddingVertical: espacamento.lg,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  lista: {
    gap: espacamento.sm,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.lg,
    backgroundColor: '#FFFFFF',
  },
  cartaoTextos: {
    flex: 1,
  },
  cartaoNome: {
    fontSize: 15,
    fontWeight: '700',
    color: cores.stone[900],
  },
  cartaoPapel: {
    fontSize: 12.5,
    color: cores.stone[600],
    marginTop: 2,
  },
  acoes: {
    gap: espacamento.sm,
    marginTop: 'auto',
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
  botaoSecundario: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingVertical: espacamento.md + 3,
  },
  textoBotaoSecundario: {
    color: cores.green[700],
    fontSize: 15,
    fontWeight: '700',
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: espacamento.xl,
    paddingBottom: espacamento.md,
  },
  linkRodape: {
    fontSize: 13,
    fontWeight: '600',
    color: cores.stone[600],
  },
});
