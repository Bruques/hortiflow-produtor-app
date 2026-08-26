import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, Info, Sprout } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { abrirSafraRequest, listarSafrasRequest } from '../services/safras';
import { statusAssinaturaRequest } from '../services/assinatura';
import { mensagemErro } from '../lib/erroApi';
import { useSafraAtiva } from '../context/SafraContext';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { cores, espacamento, raio } from '../theme';
import type { Safra } from '../types/safra';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NovaSafra'>;

function nomeSugerido(): string {
  const ano = new Date().getFullYear();
  return `Safra ${ano}/${ano + 1}`;
}

// Equivalente à frontend/src/pages/NovaSafraPage.tsx do web (docs/specs/mobile/03-safra.md).
export function NovaSafraScreen({ navigation }: Props) {
  const { safraAtiva, selecionarSafra } = useSafraAtiva();
  const sociedadeId = safraAtiva?.sociedadeId;

  const [nome, setNome] = useState(nomeSugerido());
  const [observacoes, setObservacoes] = useState('');
  const [safraEmAndamento, setSafraEmAndamento] = useState<Safra | null>(null);
  const [limiteAtingido, setLimiteAtingido] = useState<{ safrasAtivas: number; limite: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!sociedadeId) return;
    listarSafrasRequest(sociedadeId)
      .then((res) => {
        setSafraEmAndamento(res.safras.find((s) => s.status === 'EM_ANDAMENTO') ?? null);
      })
      .catch(() => {});

    // Spec 18 — avisa e já desabilita o botão antes de tentar, em vez de só deixar o erro
    // aparecer depois de tocar em "Criar" (a checagem de verdade continua no backend).
    statusAssinaturaRequest()
      .then((status) => {
        const limite = status.plano?.limiteSafrasAtivas ?? null;
        if (limite !== null && status.safrasAtivas >= limite) {
          setLimiteAtingido({ safrasAtivas: status.safrasAtivas, limite });
        }
      })
      .catch(() => {});
  }, [sociedadeId]);

  async function criar() {
    if (!sociedadeId || !nome.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      const { safra } = await abrirSafraRequest(sociedadeId, nome.trim(), observacoes.trim() || undefined);
      selecionarSafra({ safraId: safra.id, sociedadeId, safra });
      navigation.replace('Safra');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível criar a safra'));
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Nova safra</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {limiteAtingido && (
          <View style={styles.avisoLimite}>
            <AlertTriangle size={17} color={cores.red.padrao} />
            <View style={styles.avisoTextos}>
              <Text style={styles.avisoLimiteTitulo}>
                Limite de safras ativas do seu plano atingido ({limiteAtingido.safrasAtivas}/{limiteAtingido.limite})
              </Text>
              <Text style={styles.avisoLimiteTexto}>
                Encerre uma safra em andamento ou fale com a gente sobre um plano com mais espaço.
              </Text>
            </View>
          </View>
        )}

        {safraEmAndamento && (
          <View style={styles.aviso}>
            <AlertTriangle size={17} color={cores.amber.padrao} />
            <View style={styles.avisoTextos}>
              <Text style={styles.avisoTitulo}>Você já tem a {safraEmAndamento.nome} em andamento</Text>
              <Text style={styles.avisoTexto}>
                Criar uma nova safra não fecha a atual sozinha — registre um acerto final nela antes, ou os
                dois períodos vão ficar em andamento ao mesmo tempo.
              </Text>
            </View>
          </View>
        )}

        <View>
          <Text style={styles.label}>Nome da safra</Text>
          <View style={styles.campo}>
            <Sprout size={18} color={cores.green[700]} />
            <TextInput
              style={styles.input}
              placeholder="Ex: Safra 2026/2027"
              placeholderTextColor={cores.stone[400]}
              value={nome}
              onChangeText={setNome}
            />
          </View>
          <Text style={styles.legenda}>Sugerido a partir da data de hoje — pode editar livremente</Text>
        </View>

        <View>
          <Text style={styles.label}>Observações (opcional)</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Ex: Estufa | Córrego do Bom Jesus | 20 mil pés | meeiro: João"
            placeholderTextColor={cores.stone[400]}
            value={observacoes}
            onChangeText={setObservacoes}
            maxLength={500}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.legenda}>Texto livre, só pra ajudar a identificar a safra — não entra em nenhum cálculo</Text>
        </View>

        <View style={styles.info}>
          <Info size={17} color={cores.stone[600]} />
          <Text style={styles.infoTexto}>
            A partir da criação, todo lançamento novo de despesa ou venda passa a pertencer a essa safra.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <Pressable
          style={[styles.botaoPrimario, (!nome.trim() || salvando || !!limiteAtingido) && styles.botaoDesabilitado]}
          onPress={criar}
          disabled={!nome.trim() || salvando || !!limiteAtingido}
        >
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoPrimario}>Criar e iniciar safra</Text>
          )}
        </Pressable>
      </View>
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
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  aviso: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
  },
  avisoTextos: {
    flex: 1,
  },
  avisoTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  avisoTexto: {
    fontSize: 11.5,
    color: cores.amber.padrao,
    marginTop: 2,
  },
  avisoLimite: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.red.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
  },
  avisoLimiteTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.red.padrao,
  },
  avisoLimiteTexto: {
    fontSize: 11.5,
    color: cores.red.padrao,
    marginTop: 2,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: cores.stone[900],
  },
  textarea: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    fontSize: 14,
    color: cores.stone[900],
    textAlignVertical: 'top',
  },
  legenda: {
    marginTop: espacamento.xs + 2,
    fontSize: 11.5,
    color: cores.stone[400],
  },
  info: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.cream[100],
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
  },
  infoTexto: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: cores.stone[600],
  },
  rodape: {
    borderTopWidth: 1,
    borderTopColor: cores.cream[100],
    paddingHorizontal: espacamento.xl,
    paddingVertical: espacamento.md,
  },
  botaoPrimario: {
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
