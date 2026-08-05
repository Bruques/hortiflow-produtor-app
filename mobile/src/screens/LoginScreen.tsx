import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Phone, ShieldCheck, UserPlus } from 'lucide-react-native';
import { AxiosError } from 'axios';
import { loginRequest, registerRequest } from '../services/auth';
import { formatarTelefone, somenteDigitos } from '../lib/telefone';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/BrandMark';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { cores, espacamento, raio } from '../theme';

type Modo = 'login' | 'cadastro';

// Layout e paleta seguem docs/design/notas-de-design.md (seção Mobile) — mesma estrutura da
// tela de login do web (frontend/src/pages/LoginPage.tsx), agora com o modo cadastro
// (docs/specs/mobile/01-auth.md). Ao autenticar, quem decide a navegação é o AuthContext —
// entrar() muda `logado`, e o RootNavigator troca de stack sozinho.
export function LoginScreen() {
  const { entrar } = useAuth();
  const [modo, setModo] = useState<Modo>('login');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarModo() {
    setErro(null);
    setModo((m) => (m === 'login' ? 'cadastro' : 'login'));
  }

  async function handleEnviar() {
    setErro(null);
    setCarregando(true);
    const telefoneDigitos = somenteDigitos(telefone);
    try {
      const resposta =
        modo === 'login'
          ? await loginRequest(telefoneDigitos, senha)
          : await registerRequest(nome, telefoneDigitos, senha);
      await entrar(resposta.token, resposta.usuario);
    } catch (err) {
      if (modo === 'login') {
        // Mesma escolha de segurança do app web: não revela se o motivo foi telefone
        // inexistente ou senha errada.
        setErro('Telefone ou senha incorretos');
      } else {
        const mensagem =
          err instanceof AxiosError ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
        setErro(mensagem ?? 'Não foi possível cadastrar');
      }
    } finally {
      setCarregando(false);
    }
  }

  const camposObrigatoriosPreenchidos =
    telefone.length > 0 && senha.length > 0 && (modo === 'login' || nome.trim().length > 0);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.marca}>
          <BrandLockup />
        </View>

        <Text style={styles.titulo}>{modo === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}</Text>
        <Text style={styles.subtitulo}>
          {modo === 'login'
            ? 'Faça login para acessar suas sociedades e acompanhar sua safra.'
            : 'Cadastre-se para começar a acompanhar sua parceria.'}
        </Text>

        <View style={styles.form}>
          {modo === 'cadastro' && (
            <View>
              <Text style={styles.label}>Nome</Text>
              <View style={styles.campo}>
                <UserPlus size={18} color={cores.green[700]} />
                <TextInput
                  style={styles.input}
                  placeholder="Seu nome"
                  placeholderTextColor={cores.stone[400]}
                  autoComplete="name"
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
            </View>
          )}

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
                maxLength={16}
                value={telefone}
                onChangeText={(valor) => setTelefone(formatarTelefone(valor))}
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
                autoComplete={modo === 'login' ? 'password' : 'new-password'}
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
              !camposObrigatoriosPreenchidos && styles.botaoDesabilitado,
              pressed && styles.botaoPressionado,
            ]}
            onPress={handleEnviar}
            disabled={!camposObrigatoriosPreenchidos || carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>{modo === 'login' ? 'Entrar' : 'Cadastrar'}</Text>
            )}
          </Pressable>

          <Pressable style={styles.botaoSecundario} onPress={alternarModo}>
            <UserPlus size={18} color={cores.green[700]} />
            <Text style={styles.textoBotaoSecundario}>{modo === 'login' ? 'Criar conta' : 'Já tenho conta'}</Text>
          </Pressable>
        </View>

        <View style={styles.rodape}>
          <ShieldCheck size={20} color={cores.green[700]} />
          <View style={styles.rodapeTextos}>
            <Text style={styles.rodapeTitulo}>Seguro e transparente</Text>
            <Text style={styles.rodapeTexto}>Seus dados são protegidos e suas informações financeiras ficam seguras.</Text>
          </View>
        </View>
      </ScrollView>
      </TelaComTeclado>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.cream[50],
  },
  conteudo: {
    flexGrow: 1,
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.xl,
    paddingBottom: espacamento.xl,
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
    fontWeight: '700',
    fontSize: 15,
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
