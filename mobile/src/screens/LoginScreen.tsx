import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { loginRequest } from '../services/auth';
import { setToken } from '../lib/tokenStorage';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// Tela mínima, só para provar que a API responde (docs/specs/mobile/00-setup-e-infra.md) —
// formulário completo, cadastro e bootstrap de sessão offline são escopo da spec mobile 01.
export function LoginScreen({ navigation }: Props) {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleLogin() {
    setErro(null);
    setCarregando(true);
    try {
      const { token } = await loginRequest(telefone, senha);
      await setToken(token);
      navigation.replace('Home');
    } catch {
      setErro('Telefone ou senha incorretos');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>HortiFlow Produtor</Text>

      <TextInput
        style={styles.input}
        placeholder="Telefone"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={telefone}
        onChangeText={setTelefone}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        autoComplete="password"
        value={senha}
        onChangeText={setSenha}
      />

      {erro && <Text style={styles.erro}>{erro}</Text>}

      {carregando ? (
        <ActivityIndicator />
      ) : (
        <Button title="Entrar" onPress={handleLogin} disabled={!telefone || !senha} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5C0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  erro: {
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 13,
  },
});
