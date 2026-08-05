import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { trocarSenhaRequest } from '../services/auth';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TrocaSenha'>;

// Mesmo contrato e regras da tela web equivalente (frontend/src/pages/ConfiguracoesContaPage.tsx,
// spec 09 do web) — exige senha atual correta, nova senha mínima de 6 caracteres, diferente da
// atual. Sem tratamento de offline: troca de senha exige conexão (docs/specs/mobile/01-auth.md).
export function TrocaSenhaScreen({ navigation }: Props) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaNovaConfirmacao, setSenhaNovaConfirmacao] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleTrocarSenha() {
    setErro(null);
    setSucesso(false);

    if (senhaNova.length < 6) {
      setErro('A nova senha precisa ter no mínimo 6 caracteres');
      return;
    }
    if (senhaNova !== senhaNovaConfirmacao) {
      setErro('A confirmação não bate com a nova senha');
      return;
    }

    setSalvando(true);
    try {
      await trocarSenhaRequest(senhaAtual, senhaNova);
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaNovaConfirmacao('');
      setSucesso(true);
    } catch (err) {
      const mensagem =
        err instanceof AxiosError ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setErro(mensagem ?? 'Não foi possível trocar a senha');
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = Boolean(senhaAtual && senhaNova && senhaNovaConfirmacao) && !salvando;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Conta e Senha</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.titulo}>Trocar senha</Text>
          <Text style={styles.subtitulo}>Confirme a senha atual para definir uma nova</Text>
        </View>

        <View style={styles.cartao}>
          <View>
            <Text style={styles.label}>Senha atual</Text>
            <View style={styles.campo}>
              <Lock size={18} color={cores.green[700]} />
              <TextInput
                style={styles.input}
                secureTextEntry={!mostrarSenha}
                value={senhaAtual}
                onChangeText={setSenhaAtual}
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

          <View>
            <Text style={styles.label}>Nova senha</Text>
            <View style={styles.campo}>
              <Lock size={18} color={cores.green[700]} />
              <TextInput
                style={styles.input}
                secureTextEntry={!mostrarSenha}
                value={senhaNova}
                onChangeText={setSenhaNova}
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Confirmar nova senha</Text>
            <View style={styles.campo}>
              <Lock size={18} color={cores.green[700]} />
              <TextInput
                style={styles.input}
                secureTextEntry={!mostrarSenha}
                value={senhaNovaConfirmacao}
                onChangeText={setSenhaNovaConfirmacao}
              />
            </View>
          </View>

          {erro && <Text style={styles.erro}>{erro}</Text>}
          {sucesso && <Text style={styles.sucesso}>Senha atualizada!</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.botaoPrimario,
              !podeSalvar && styles.botaoDesabilitado,
              pressed && styles.botaoPressionado,
            ]}
            onPress={handleTrocarSenha}
            disabled={!podeSalvar}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>Trocar senha</Text>
            )}
          </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.lg,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
  },
  subtitulo: {
    fontSize: 12,
    color: cores.stone[400],
    marginTop: 2,
  },
  cartao: {
    gap: espacamento.md,
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
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm + 2,
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
  sucesso: {
    color: cores.green[700],
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  botaoPrimario: {
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 4,
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
    fontSize: 14,
    fontWeight: '700',
  },
});
