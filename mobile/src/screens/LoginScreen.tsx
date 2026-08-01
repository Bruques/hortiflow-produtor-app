import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Phone, ShieldCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { loginRequest } from '../services/auth';
import { setToken } from '../lib/tokenStorage';
import { BrandLockup } from '../components/BrandMark';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// Layout e paleta seguem docs/design/notas-de-design.md (seção Mobile) — mesma estrutura da
// tela de login do web (frontend/src/pages/LoginPage.tsx), sem o modo "cadastro" ainda
// (cadastro completo é escopo da spec mobile 01-auth.md).
export function LoginScreen({ navigation }: Props) {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.conteudo}>
        <View style={styles.marca}>
          <BrandLockup />
        </View>

        <Text style={styles.titulo}>Bem-vindo de volta!</Text>
        <Text style={styles.subtitulo}>Faça login para acessar suas sociedades e acompanhar sua safra.</Text>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Telefone</Text>
            <View style={styles.campo}>
              <Phone size={18} color={cores.green[700]} />
              <TextInput
                style={styles.input}
                placeholder="(35) 99730-2015"
                placeholderTextColor={cores.stone[400]}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={telefone}
                onChangeText={setTelefone}
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.campo}>
              <Lock size={18} color={cores.green[700]} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor={cores.stone[400]}
                secureTextEntry={!mostrarSenha}
                autoComplete="password"
                value={senha}
                onChangeText={setSenha}
              />
              <Pressable onPress={() => setMostrarSenha((v) => !v)} hitSlop={8}>
                {mostrarSenha ? (
                  <EyeOff size={19} color={cores.green[700]} />
                ) : (
                  <Eye size={19} color={cores.green[700]} />
                )}
              </Pressable>
            </View>
          </View>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.botaoPrimario,
              (!telefone || !senha) && styles.botaoDesabilitado,
              pressed && styles.botaoPressionado,
            ]}
            onPress={handleLogin}
            disabled={!telefone || !senha || carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>Entrar</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.rodape}>
          <ShieldCheck size={20} color={cores.green[700]} />
          <View style={styles.rodapeTextos}>
            <Text style={styles.rodapeTitulo}>Seguro e transparente</Text>
            <Text style={styles.rodapeTexto}>Seus dados são protegidos e suas informações financeiras ficam seguras.</Text>
          </View>
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
    paddingTop: espacamento.xl,
    justifyContent: 'center',
    gap: espacamento.lg,
  },
  marca: {
    marginBottom: espacamento.sm,
  },
  titulo: {
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    color: cores.stone[900],
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: cores.stone[600],
    maxWidth: 260,
    alignSelf: 'center',
  },
  form: {
    gap: espacamento.md,
    marginTop: espacamento.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.xs + 2,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  input: {
    flex: 1,
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
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
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
    fontSize: 16,
    fontWeight: '700',
  },
  rodape: {
    flexDirection: 'row',
    gap: espacamento.md,
    backgroundColor: cores.cream[100],
    borderRadius: raio.lg,
    padding: espacamento.lg,
  },
  rodapeTextos: {
    flex: 1,
  },
  rodapeTitulo: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  rodapeTexto: {
    fontSize: 12.5,
    lineHeight: 17,
    color: cores.stone[600],
    marginTop: 2,
  },
});
