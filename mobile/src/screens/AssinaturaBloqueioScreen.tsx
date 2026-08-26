import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, PhoneCall } from 'lucide-react-native';
import { cores, espacamento, raio } from '../theme';

// Equivalente a frontend/src/pages/AssinaturaBloqueadaPage.tsx (spec 18). Mostrada quando o
// interceptor de resposta (AuthContext.tsx) recebe 402 de qualquer chamada — assinatura do
// titular da sociedade/safra vencida. Contato fixo: manter em sincronia com
// WHATSAPP_CONTATO/EMAIL_CONTATO do backend (backend/.env), igual ao comentário do web.
const WHATSAPP_CONTATO = '(35) 99730-2015';
const EMAIL_CONTATO = 'contato.hortiflow@gmail.com';

export function AssinaturaBloqueioScreen() {
  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.conteudo}>
        <Text style={styles.titulo}>Seu acesso ao HortiFlow expirou</Text>
        <Text style={styles.subtitulo}>Fale com a gente para continuar usando o app e liberar seu plano.</Text>

        <View style={styles.card}>
          <Pressable
            style={styles.botaoPrimario}
            onPress={() => Linking.openURL(`https://wa.me/55${WHATSAPP_CONTATO.replace(/\D/g, '')}`)}
          >
            <PhoneCall size={16} color="#FFFFFF" />
            <Text style={styles.textoBotaoPrimario}>WhatsApp {WHATSAPP_CONTATO}</Text>
          </Pressable>
          <Pressable style={styles.botaoSecundario} onPress={() => Linking.openURL(`mailto:${EMAIL_CONTATO}`)}>
            <Mail size={16} color={cores.stone[900]} />
            <Text style={styles.textoBotaoSecundario}>{EMAIL_CONTATO}</Text>
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
    justifyContent: 'center',
  },
  conteudo: {
    alignItems: 'center',
    gap: espacamento.md,
    paddingHorizontal: espacamento.xl,
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
  card: {
    marginTop: espacamento.sm,
    width: '100%',
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  botaoPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    backgroundColor: cores.green[800],
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  botaoSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  textoBotaoSecundario: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
});
