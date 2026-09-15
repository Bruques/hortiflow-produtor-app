import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { checkoutRequest, statusAssinaturaRequest } from '../services/assinatura';
import { mensagemErro } from '../lib/erroApi';
import { formatarCpf } from '../lib/formatacao';
import { cores, espacamento, raio } from '../theme';
import type { AssinaturaStatus } from '../types/assinatura';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const RETORNO_URL = 'hortiflowprodutor://checkout-retorno';

interface PixGerado {
  qrCode: string;
  qrCodeBase64: string;
}

// Spec 25 — checkout pós-trial: plano e ciclo vêm pré-selecionados do que o produtor
// escolheu na tela de plano, mas podem ser trocados aqui.
//
// Cartão: abre o checkout hospedado do Mercado Pago numa aba de navegador in-app (sem
// WebView própria) — o produtor paga lá e volta pro app pelo deep link do `expo.scheme`.
// Pix: NÃO redireciona — testado em 2026-09-15 e o Checkout Pro exige login numa conta
// Mercado Pago pra pagar via Pix, o que não serve pro nosso caso. Em vez disso, mostra o
// QR Code direto nesta tela (gerado via API de Pagamentos, que exige CPF do pagador).
export function CheckoutScreen({ navigation }: Props) {
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [metodo, setMetodo] = useState<'CARTAO' | 'PIX'>('CARTAO');
  const [cpf, setCpf] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        setStatus(dados);
        if (dados.ciclo) setCiclo(dados.ciclo);
      })
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
  }, []);

  const cpfValido = cpf.replace(/\D/g, '').length === 11;

  async function irParaPagamento() {
    if (!status?.plano) return;
    if (metodo === 'PIX' && !cpfValido) return;
    setProcessando(true);
    setErro(null);
    try {
      const resultado = await checkoutRequest({
        planoId: status.plano.id,
        ciclo,
        metodo,
        cpf: metodo === 'PIX' ? cpf.replace(/\D/g, '') : undefined,
      });

      if (resultado.tipo === 'PIX') {
        setPix({ qrCode: resultado.qrCode, qrCodeBase64: resultado.qrCodeBase64 });
        return;
      }

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

  async function copiarCodigoPix() {
    if (!pix) return;
    await Clipboard.setStringAsync(pix.qrCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (pix) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.conteudo}>
          <Text style={styles.titulo}>Escaneie pra pagar</Text>
          <Text style={styles.subtitulo}>Abra o app do seu banco, escaneie o QR Code ou cole o código copia-e-cola.</Text>

          <Image source={{ uri: `data:image/png;base64,${pix.qrCodeBase64}` }} style={styles.qrCode} resizeMode="contain" />

          <Pressable style={styles.botaoCopiar} onPress={copiarCodigoPix}>
            {copiado ? <Check size={16} color={cores.green[700]} /> : <Copy size={16} color={cores.green[700]} />}
            <Text style={styles.textoBotaoCopiar}>{copiado ? 'Código copiado' : 'Copiar código Pix'}</Text>
          </Pressable>

          <Text style={styles.avisoPix}>
            Assim que o pagamento for confirmado, seu acesso é liberado automaticamente — não precisa voltar aqui.
          </Text>

          <Pressable style={styles.linkVoltar} onPress={() => navigation.replace('Inicio')}>
            <Text style={styles.textoLinkVoltar}>Voltar pro início</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
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

            {metodo === 'PIX' && (
              <View style={styles.grupo}>
                <Text style={styles.grupoLabel}>CPF (exigido pelo Mercado Pago pra gerar o Pix)</Text>
                <View style={styles.campo}>
                  <TextInput
                    style={styles.input}
                    placeholder="000.000.000-00"
                    placeholderTextColor={cores.stone[400]}
                    keyboardType="number-pad"
                    maxLength={14}
                    value={formatarCpf(cpf)}
                    onChangeText={(valor) => setCpf(valor.replace(/\D/g, ''))}
                  />
                </View>
              </View>
            )}

            {ciclo === 'MENSAL' && metodo === 'PIX' && (
              <Text style={styles.aviso}>
                No Pix mensal não há débito automático — você recebe um novo código todo mês e precisa pagar manualmente.
              </Text>
            )}

            {erro && <Text style={styles.erro}>{erro}</Text>}

            <Pressable
              style={[styles.botaoPrimario, (processando || (metodo === 'PIX' && !cpfValido)) && styles.botaoDesabilitado]}
              onPress={irParaPagamento}
              disabled={processando || (metodo === 'PIX' && !cpfValido)}
            >
              {processando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.textoBotaoPrimario}>{metodo === 'PIX' ? 'Gerar QR Code' : 'Ir para pagamento'}</Text>
              )}
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
  campo: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    backgroundColor: '#FFFFFF',
  },
  input: {
    fontSize: 15,
    color: cores.stone[900],
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
  qrCode: {
    width: 240,
    height: 240,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  botaoCopiar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.green[700],
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
  },
  textoBotaoCopiar: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.green[700],
  },
  avisoPix: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    color: cores.stone[600],
  },
  linkVoltar: {
    marginTop: espacamento.sm,
    alignItems: 'center',
  },
  textoLinkVoltar: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.green[700],
  },
});
