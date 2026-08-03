import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafraAtiva } from '../context/SafraContext';
import { useAuth } from '../context/AuthContext';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { ROTULO_STATUS_SAFRA } from '../lib/rotulos';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Safra'>;

// Placeholder "dentro da safra" — só prova que o SafraContext propaga corretamente
// (critério de aceite 8 da docs/specs/mobile/03-safra.md). O Resumo de verdade (Despesas,
// Vendas, Painel) chega nas specs seguintes; a bottom nav/Menu reais são a spec `08`. Até lá,
// os atalhos que normalmente ficariam no Menu (Sócios, Safras da sociedade, Conta) moram aqui.
export function SafraScreen({ navigation }: Props) {
  const { safraAtiva } = useSafraAtiva();
  const { sair } = useAuth();

  if (!safraAtiva) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <View style={styles.conteudo}>
          <Text style={styles.subtitulo}>Nenhuma safra selecionada.</Text>
          <Pressable style={styles.botaoPrimario} onPress={() => navigation.replace('Inicio')}>
            <Text style={styles.textoBotaoPrimario}>Voltar ao início</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { safra, sociedadeId } = safraAtiva;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <BannerSemConexao />
      <View style={styles.conteudo}>
        <Pressable onPress={() => navigation.navigate('Inicio')}>
          <Text style={styles.linkTrocar}>Trocar de safra</Text>
        </Pressable>

        <View>
          <Text style={styles.titulo}>{safra.nome}</Text>
          <Text style={styles.badgeStatus}>{ROTULO_STATUS_SAFRA[safra.status]}</Text>
          {safra.observacoes && <Text style={styles.observacoes}>{safra.observacoes}</Text>}
        </View>

        <Text style={styles.avisoPlaceholder}>
          Resumo e Vendas ainda não existem no app — chegam nas próximas specs.
        </Text>

        <View style={styles.links}>
          <Pressable
            style={styles.link}
            onPress={() => navigation.navigate('Despesas', { safraId: safra.id, sociedadeId })}
          >
            <Text style={styles.linkTexto}>Despesas</Text>
          </Pressable>
          <Pressable
            style={styles.link}
            onPress={() => navigation.navigate('Socios', { sociedadeId })}
          >
            <Text style={styles.linkTexto}>Sócios e Sociedade</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => navigation.navigate('Safras')}>
            <Text style={styles.linkTexto}>Todas as safras desta sociedade</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => navigation.navigate('TrocaSenha')}>
            <Text style={styles.linkTexto}>Trocar senha</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={sair}>
            <Text style={styles.linkTexto}>Sair</Text>
          </Pressable>
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
    paddingTop: espacamento.lg,
    gap: espacamento.lg,
  },
  linkTrocar: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.green[700],
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: cores.stone[900],
  },
  badgeStatus: {
    alignSelf: 'flex-start',
    marginTop: espacamento.xs + 2,
    fontSize: 11,
    fontWeight: '700',
    color: cores.green[700],
    backgroundColor: cores.green[100],
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: espacamento.xs,
  },
  observacoes: {
    marginTop: espacamento.sm,
    fontSize: 13.5,
    color: cores.stone[600],
  },
  subtitulo: {
    fontSize: 14,
    color: cores.stone[600],
    textAlign: 'center',
  },
  avisoPlaceholder: {
    fontSize: 12.5,
    color: cores.stone[400],
    backgroundColor: cores.cream[100],
    borderRadius: raio.md,
    padding: espacamento.md,
  },
  links: {
    gap: espacamento.sm,
    marginTop: 'auto',
    paddingBottom: espacamento.md,
  },
  link: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    paddingHorizontal: espacamento.lg,
  },
  linkTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: cores.stone[900],
  },
  botaoPrimario: {
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
    alignItems: 'center',
    backgroundColor: cores.green[800],
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
