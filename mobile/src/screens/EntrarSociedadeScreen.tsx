import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { entrarSociedadeRequest, previewConviteRequest } from '../services/sociedades';
import { mensagemErro } from '../lib/erroApi';
import { cores, espacamento, raio } from '../theme';
import type { SocioSemConta } from '../types/sociedade';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EntrarSociedade'>;

// Mesmo fluxo de duas etapas do web (frontend/src/pages/EntrarSociedadePage.tsx): busca o
// preview do convite primeiro; se a sociedade já tem sócios sem conta cadastrados, pergunta
// "é algum desses sócios?" antes de confirmar o vínculo (docs/specs/mobile/02-sociedade-e-socios.md).
export function EntrarSociedadeScreen({ navigation }: Props) {
  const [codigoInput, setCodigoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [codigoConfirmado, setCodigoConfirmado] = useState<string | null>(null);
  const [sociosSemConta, setSociosSemConta] = useState<SocioSemConta[]>([]);

  async function confirmarEntrada(codigo: string, vincularSocioId?: string) {
    setErro(null);
    setEntrando(true);
    try {
      await entrarSociedadeRequest(codigo, vincularSocioId);
      // Mesmo padrão do web (navigate('/') e deixar a Home decidir): a tela de Início
      // recarrega a lista de safras e decide sozinha pra onde ir (docs/specs/mobile/03-safra.md).
      navigation.replace('Inicio');
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setErro('Código de convite ou sócio não encontrado');
      } else if (err instanceof AxiosError && err.response?.status === 409) {
        setErro('Você já é sócio dessa sociedade, ou esse sócio já está vinculado a uma conta');
      } else {
        setErro(mensagemErro(err, 'Não foi possível entrar na sociedade'));
      }
      setCodigoConfirmado(null);
    } finally {
      setEntrando(false);
    }
  }

  async function handleBuscarCodigo() {
    setErro(null);
    setBuscando(true);
    try {
      const preview = await previewConviteRequest(codigoInput);
      if (preview.socios_sem_conta.length === 0) {
        await confirmarEntrada(codigoInput);
        return;
      }
      setCodigoConfirmado(codigoInput);
      setSociosSemConta(preview.socios_sem_conta);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setErro('Código de convite não encontrado');
      } else {
        setErro(mensagemErro(err, 'Não foi possível entrar na sociedade'));
      }
    } finally {
      setBuscando(false);
    }
  }

  if (codigoConfirmado) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <View style={styles.cabecalho}>
          <Pressable
            style={styles.botaoVoltar}
            onPress={() => setCodigoConfirmado(null)}
            hitSlop={8}
            disabled={entrando}
          >
            <ArrowLeft size={18} color={cores.stone[900]} />
          </Pressable>
          <Text style={styles.tituloCabecalho}>É algum desses sócios?</Text>
          <View style={styles.botaoVoltar} />
        </View>

        <View style={styles.conteudo}>
          <Text style={styles.subtitulo}>
            Essa sociedade já tem sócios cadastrados sem conta — se um deles é você, sua conta
            assume o percentual e o histórico já registrados.
          </Text>

          <View style={styles.lista}>
            {sociosSemConta.map((s) => (
              <Pressable
                key={s.id}
                style={styles.opcaoSocio}
                onPress={() => confirmarEntrada(codigoConfirmado, s.id)}
                disabled={entrando}
              >
                <Text style={styles.opcaoSocioTexto}>{s.nome}</Text>
              </Pressable>
            ))}
          </View>

          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Pressable
            style={({ pressed }) => [styles.botaoPrimario, pressed && styles.botaoPressionado]}
            onPress={() => confirmarEntrada(codigoConfirmado)}
            disabled={entrando}
          >
            {entrando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotaoPrimario}>Não, sou novo sócio</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Entrar com código</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <View style={styles.conteudo}>
        <Text style={styles.subtitulo}>Informe o código de 6 dígitos recebido do outro sócio.</Text>

        <View>
          <Text style={styles.label}>Código</Text>
          <TextInput
            style={[styles.input, styles.inputCodigo]}
            placeholder="482913"
            placeholderTextColor={cores.stone[400]}
            keyboardType="number-pad"
            maxLength={6}
            value={codigoInput}
            onChangeText={(v) => setCodigoInput(v.replace(/\D/g, ''))}
          />
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.botaoPrimario,
            codigoInput.length !== 6 && styles.botaoDesabilitado,
            pressed && styles.botaoPressionado,
          ]}
          onPress={handleBuscarCodigo}
          disabled={codigoInput.length !== 6 || buscando}
        >
          {buscando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Entrar</Text>}
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
    flex: 1,
    textAlign: 'center',
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
  inputCodigo: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  lista: {
    gap: espacamento.sm,
  },
  opcaoSocio: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  opcaoSocioTexto: {
    fontSize: 15,
    fontWeight: '600',
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
