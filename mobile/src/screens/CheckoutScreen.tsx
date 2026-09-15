import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { checkoutRequest, statusAssinaturaRequest } from '../services/assinatura';
import { mensagemErro } from '../lib/erroApi';
import { cores, espacamento, raio } from '../theme';
import type { AssinaturaStatus } from '../types/assinatura';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const RETORNO_URL = 'hortiflowprodutor://checkout-retorno';

// Spec 25 — checkout pós-trial: plano e ciclo vêm pré-selecionados do que o produtor
// escolheu na tela de plano, mas podem ser trocados aqui. Ao confirmar, o app abre o
// checkout hospedado do Mercado Pago numa aba de navegador in-app (sem WebView própria) —
// o produtor paga lá e volta pro app pelo deep link configurado em `expo.scheme`.
//
// Cartão e Pix vão os dois por esse mesmo caminho hoje: tentamos um Pix sem redirecionar
// (QR Code direto via API de Pagamentos), mas a conta de teste bateu num erro de
// autorização do Mercado Pago não resolvido ainda — ver aviso em
// backend/src/services/mercadopago.service.ts.
export function CheckoutScreen({ navigation }: Props) {
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [metodo, setMetodo] = useState<'CARTAO' | 'PIX'>('CARTAO');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        setStatus(dados);
        if (dados.ciclo) setCiclo(dados.ciclo);
      })
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
  }, []);

  async function irParaPagamento() {
    if (!status?.plano) return;
    setProcessando(true);
    setErro(null);
    try {
      const resultado = await checkoutRequest({ planoId: status.plano.id, ciclo, metodo });
      await WebBrowser.openAuthSessionAsync(resultado.initPoint, RETORNO_URL);
      // A confirmação de pagamento chega por webhook (assíncrona) — não sabemos aqui se já
      // foi processada. Volta pra Início; se o pagamento ainda não confirmou, o próximo 402
      // (se houver) leva de volta pra esta tela normalmente.
      navigation.replace('Inicio');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível iniciar o pagamento'));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text style={styles.titulo}>Assinar {status?.plano?.nome ?? ''}</Text>
        <Text style={styles.subtitulo}>Escolha o ciclo e a forma de pagamento pra continuar usando o HortiFlow.</Text>

        {carregando && <ActivityIndicator />}

        {!carregando && (
          <>
            <View style={styles.grupo}>
              <Text style={styles.grupoLabel}>Ciclo</Text>
              <View style={styles.opcoes}>
                <Opcao rotulo="Mensal" ativo={ciclo === 'MENSAL'} onPress={() => setCiclo('MENSAL')} />
                <Opcao rotulo="Anual" ativo={ciclo === 'ANUAL'} onPress={() => setCiclo('ANUAL')} />
              </View>
            </View>

            <View style={styles.grupo}>
              <Text style={styles.grupoLabel}>Forma de pagamento</Text>
              <View style={styles.opcoes}>
                <Opcao rotulo="Cartão de crédito" ativo={metodo === 'CARTAO'} onPress={() => setMetodo('CARTAO')} />
                <Opcao rotulo="Pix" ativo={metodo === 'PIX'} onPress={() => setMetodo('PIX')} />
              </View>
            </View>

            {ciclo === 'MENSAL' && metodo === 'PIX' && (
              <Text style={styles.aviso}>
                No Pix mensal não há débito automático — você recebe um novo código todo mês e precisa pagar manualmente.
              </Text>
            )}

            {erro && <Text style={styles.erro}>{erro}</Text>}

            <Pressable style={[styles.botaoPrimario, processando && styles.botaoDesabilitado]} onPress={irParaPagamento} disabled={processando}>
              {processando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Ir para pagamento</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Opcao({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.opcao, ativo && styles.opcaoAtiva]} onPress={onPress}>
      <Text style={[styles.opcaoTexto, ativo && styles.opcaoTextoAtivo]}>{rotulo}</Text>
    </Pressable>
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
    paddingTop: espacamento.xxl,
    paddingBottom: espacamento.xl,
    gap: espacamento.lg,
  },
  titulo: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    color: cores.stone[900],
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: cores.stone[600],
  },
  grupo: {
    gap: espacamento.sm,
  },
  grupoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  opcoes: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  opcao: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingVertical: espacamento.md,
    backgroundColor: '#FFFFFF',
  },
  opcaoAtiva: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  opcaoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[600],
  },
  opcaoTextoAtivo: {
    color: cores.green[800],
  },
  aviso: {
    fontSize: 12,
    lineHeight: 17,
    color: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 2,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  botaoPrimario: {
    marginTop: 'auto',
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg - 2,
    alignItems: 'center',
    backgroundColor: cores.green[800],
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
