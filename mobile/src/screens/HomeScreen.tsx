import { Button, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { clearToken } from '../lib/tokenStorage';
import { BannerSemConexao } from '../components/BannerSemConexao';
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
    <View style={styles.container}>
      <BannerSemConexao />
      <View style={styles.conteudo}>
        <Text style={styles.texto}>Você está logado.</Text>
        <Button title="Sair" onPress={handleLogout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  conteudo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  texto: {
    fontSize: 16,
  },
});
