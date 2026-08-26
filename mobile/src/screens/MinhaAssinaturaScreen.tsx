import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { statusAssinaturaRequest, cancelarAssinaturaRequest } from '../services/assinatura';
import { mensagemErro } from '../lib/erroApi';
import { cores, espacamento, raio } from '../theme';
import type { AssinaturaStatus } from '../types/assinatura';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MinhaAssinatura'>;

const ROTULO_STATUS: Record<AssinaturaStatus['status'], string> = {
  TRIAL: 'Período de teste',
  ATIVA: 'Ativa',
  CANCELADA: 'Cancelada',
};

// Equivalente a frontend/src/pages/MinhaAssinaturaPage.tsx (spec 18).
export function MinhaAssinaturaScreen({ navigation }: Props) {
  const [dados, setDados] = useState<AssinaturaStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    statusAssinaturaRequest()
      .then(setDados)
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cancelar() {
    setCancelando(true);
    setErro(null);
    try {
      await cancelarAssinaturaRequest();
      setConfirmarCancelamento(false);
      carregar();
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível cancelar a assinatura'));
    } finally {
      setCancelando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Minha assinatura</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        {carregando && <ActivityIndicator />}

        {!carregando && dados && (
          <View style={styles.card}>
            <View style={styles.linha}>
              <Text style={styles.rotulo}>Plano</Text>
              <Text style={styles.valor}>{dados.plano?.nome ?? 'Ainda não atribuído'}</Text>
            </View>
            <View style={styles.linha}>
              <Text style={styles.rotulo}>Situação</Text>
              <Text style={[styles.valor, dados.vencida && styles.valorVencido]}>
                {dados.vencida ? 'Vencida' : ROTULO_STATUS[dados.status]}
              </Text>
            </View>
            <View style={styles.linha}>
              <Text style={styles.rotulo}>{dados.vencida ? 'Venceu em' : 'Acesso liberado até'}</Text>
              <Text style={styles.valor}>{new Date(dados.dataFimAcesso).toLocaleDateString('pt-BR')}</Text>
            </View>
            {dados.plano?.limiteSafrasAtivas !== null && dados.plano !== null && (
              <View style={styles.linha}>
                <Text style={styles.rotulo}>Safras ativas</Text>
                <Text style={styles.valor}>
                  {dados.safrasAtivas} de {dados.plano?.limiteSafrasAtivas}
                </Text>
              </View>
            )}
          </View>
        )}

        {erro && <Text style={styles.erro}>{erro}</Text>}

        {!carregando && dados?.podeCancelar && !confirmarCancelamento && (
          <Pressable style={styles.botaoCancelar} onPress={() => setConfirmarCancelamento(true)}>
            <Text style={styles.textoBotaoCancelar}>Cancelar assinatura</Text>
          </Pressable>
        )}

        {confirmarCancelamento && (
          <View style={styles.confirmacao}>
            <Text style={styles.confirmacaoTexto}>
              Sua próxima cobrança não vai acontecer. O acesso continua liberado até{' '}
              {dados && new Date(dados.dataFimAcesso).toLocaleDateString('pt-BR')}. Tem certeza?
            </Text>
            <View style={styles.confirmacaoBotoes}>
              <Pressable style={styles.botaoVoltarConfirmacao} onPress={() => setConfirmarCancelamento(false)}>
                <Text style={styles.textoBotaoVoltarConfirmacao}>Voltar</Text>
              </Pressable>
              <Pressable style={styles.botaoConfirmar} onPress={cancelar} disabled={cancelando}>
                {cancelando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoConfirmar}>Confirmar</Text>}
              </Pressable>
            </View>
          </View>
        )}
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
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.lg,
    gap: espacamento.lg,
  },
  card: {
    gap: espacamento.sm + 4,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rotulo: {
    fontSize: 12,
    fontWeight: '700',
    color: cores.green[700],
  },
  valor: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  valorVencido: {
    color: cores.red.padrao,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  botaoCancelar: {
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.red.padrao,
  },
  textoBotaoCancelar: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.red.padrao,
  },
  confirmacao: {
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.red.padrao,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  confirmacaoTexto: {
    fontSize: 13.5,
    color: cores.stone[900],
  },
  confirmacaoBotoes: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  botaoVoltarConfirmacao: {
    flex: 1,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.linha,
  },
  textoBotaoVoltarConfirmacao: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  botaoConfirmar: {
    flex: 1,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    alignItems: 'center',
    backgroundColor: cores.red.padrao,
  },
  textoBotaoConfirmar: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
