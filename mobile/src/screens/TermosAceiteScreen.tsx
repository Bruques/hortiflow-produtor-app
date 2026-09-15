import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Square, SquareCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { aceitarTermosRequest } from '../services/termos';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TermosAceite'>;

// Spec 26 — equivalente a frontend/src/pages/TermosAceitePage.tsx. Chegada aqui via
// interceptor do apiClient (AuthContext.tsx) quando qualquer chamada autenticada retorna 401
// TERMOS_PENDENTES: usuário já cadastrado antes dessa funcionalidade existir, ou versão
// vigente publicada depois do último aceite dele.
export function TermosAceiteScreen({ navigation }: Props) {
  const { sair } = useAuth();
  const [aceitou, setAceitou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await aceitarTermosRequest();
      navigation.replace('Inicio');
    } catch {
      setErro('Não foi possível registrar o aceite. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text style={styles.titulo}>Termos de Uso e Política de Privacidade</Text>
        <Text style={styles.subtitulo}>
          Atualizamos nossos documentos. Para continuar usando o HortiFlow Produtor, leia e aceite abaixo.
        </Text>

        <Pressable
          style={styles.botaoSecundario}
          onPress={() => navigation.navigate('TermosDocumento', { documento: 'uso' })}
        >
          <Text style={styles.textoBotaoSecundario}>Ler Termos de Uso</Text>
        </Pressable>
        <Pressable
          style={styles.botaoSecundario}
          onPress={() => navigation.navigate('TermosDocumento', { documento: 'privacidade' })}
        >
          <Text style={styles.textoBotaoSecundario}>Ler Política de Privacidade</Text>
        </Pressable>

        <Pressable style={styles.linhaCheckbox} onPress={() => setAceitou((v) => !v)}>
          {aceitou ? (
            <SquareCheck size={20} color={cores.green[800]} />
          ) : (
            <Square size={20} color={cores.stone[400]} />
          )}
          <Text style={styles.textoCheckbox}>
            Li e concordo com os Termos de Uso e a Política de Privacidade do HortiFlow Produtor.
          </Text>
        </Pressable>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.botaoPrimario,
            (!aceitou || enviando) && styles.botaoDesabilitado,
            pressed && styles.botaoPressionado,
          ]}
          onPress={confirmar}
          disabled={!aceitou || enviando}
        >
          {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Aceitar e continuar</Text>}
        </Pressable>

        <Pressable style={styles.botaoSair} onPress={() => sair()}>
          <LogOut size={18} color={cores.red.padrao} />
          <Text style={styles.textoBotaoSair}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamento.md,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.xl,
  },
  titulo: {
    fontSize: 19,
    fontWeight: '800',
    color: cores.stone[900],
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 13,
    color: cores.stone[400],
    textAlign: 'center',
  },
  botaoSecundario: {
    width: '100%',
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.sm + 4,
    alignItems: 'center',
  },
  textoBotaoSecundario: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  linhaCheckbox: {
    marginTop: espacamento.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm,
  },
  textoCheckbox: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: cores.stone[600],
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  botaoPrimario: {
    width: '100%',
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
  botaoSair: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.red.padrao,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
  },
  textoBotaoSair: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.red.padrao,
  },
});
