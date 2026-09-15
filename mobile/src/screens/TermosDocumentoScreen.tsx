import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE } from '../content/documentosLegais';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TermosDocumento'>;

// Spec 26 — leitura completa de um documento legal. Acessível tanto sem login (a partir do
// cadastro, antes de aceitar) quanto logado (a partir de Conta e Senha), por isso é declarada
// fora do bloco condicional logado/deslogado do RootNavigator.
export function TermosDocumentoScreen({ route, navigation }: Props) {
  const documento = route.params.documento === 'uso' ? TERMOS_DE_USO : POLITICA_DE_PRIVACIDADE;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho} numberOfLines={1}>
          {documento.titulo}
        </Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        <Text style={styles.versao}>
          Versão {documento.versao} — última atualização em {documento.atualizadoEm}
        </Text>
        <Text style={styles.paragrafo}>{documento.intro}</Text>

        {documento.secoes.map((secao) => (
          <View key={secao.titulo} style={styles.secao}>
            <Text style={styles.tituloSecao}>{secao.titulo}</Text>
            {secao.paragrafos.map((paragrafo, i) => (
              <Text key={i} style={styles.paragrafo}>
                {paragrafo}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
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
    gap: espacamento.sm,
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
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: cores.stone[900],
  },
  conteudo: {
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.lg,
  },
  versao: {
    fontSize: 12,
    color: cores.stone[400],
  },
  secao: {
    gap: espacamento.xs + 2,
  },
  tituloSecao: {
    fontSize: 14,
    fontWeight: '800',
    color: cores.stone[900],
  },
  paragrafo: {
    fontSize: 13.5,
    lineHeight: 19,
    color: cores.stone[600],
  },
});
