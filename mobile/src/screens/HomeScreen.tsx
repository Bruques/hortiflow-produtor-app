import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { clearToken } from '../lib/tokenStorage';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Placeholder — só prova que a navegação pós-login funciona (docs/specs/mobile/00-setup-e-infra.md).
// As telas reais (sociedade, safra, despesas...) chegam nas specs seguintes.
export function HomeScreen({ navigation }: Props) {
  async function handleLogout() {
    await clearToken();
    navigation.replace('Login');
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.conteudo}>
        <Text style={styles.texto}>Você está logado.</Text>
        <Pressable style={styles.botao} onPress={handleLogout}>
          <Text style={styles.textoBotao}>Sair</Text>
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
  conteudo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.lg,
  },
  texto: {
    fontSize: 16,
    color: cores.stone[900],
  },
  botao: {
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
  },
  textoBotao: {
    color: cores.green[700],
    fontWeight: '700',
    fontSize: 15,
  },
});
