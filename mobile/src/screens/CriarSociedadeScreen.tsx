import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { criarSociedadeRequest } from '../services/sociedades';
import { mensagemErro } from '../lib/erroApi';
import { useSociedadeAtiva } from '../context/SociedadeContext';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CriarSociedade'>;

// Ação rara que exige conexão no momento (docs/specs/mobile/02-sociedade-e-socios.md) — sem
// fila offline, mensagem clara em caso de falha de rede (ver src/lib/erroApi.ts).
export function CriarSociedadeScreen({ navigation }: Props) {
  const { selecionarSociedade } = useSociedadeAtiva();
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleCriar() {
    setErro(null);
    setCarregando(true);
    try {
      const { sociedade } = await criarSociedadeRequest(nome.trim());
      selecionarSociedade(sociedade);
      navigation.replace('Socios');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível criar a sociedade'));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Criar sociedade</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <View style={styles.conteudo}>
        <Text style={styles.subtitulo}>
          Dê um nome pra sua propriedade ou parceria. Você começa como sócio com 100% do lucro — se
          houver outro sócio, ajuste os percentuais depois.
        </Text>

        <View>
          <Text style={styles.label}>Nome da sociedade</Text>
          <TextInput
            style={styles.input}
            placeholder="Sítio Boa Vista"
            placeholderTextColor={cores.stone[400]}
            value={nome}
            onChangeText={setNome}
          />
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.botaoPrimario,
            !nome.trim() && styles.botaoDesabilitado,
            pressed && styles.botaoPressionado,
          ]}
          onPress={handleCriar}
          disabled={!nome.trim() || carregando}
        >
          {carregando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Criar</Text>}
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
    flex: 1,
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.lg,
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
    color: cores.stone[600],
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.xs + 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
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
});
