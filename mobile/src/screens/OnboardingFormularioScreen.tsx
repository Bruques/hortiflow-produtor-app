import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { onboardingRequest } from '../services/assinatura';
import { mensagemErro } from '../lib/erroApi';
import { useAuth } from '../context/AuthContext';
import { cores, espacamento, raio } from '../theme';
import type { FaixaMeeiros, LocalizacaoProducao } from '../types/assinatura';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingFormulario'>;

const OPCOES_MEEIROS: { valor: FaixaMeeiros; rotulo: string }[] = [
  { valor: 'UM_A_TRES', rotulo: '1 a 3' },
  { valor: 'QUATRO_A_DEZ', rotulo: '4 a 10' },
  { valor: 'DEZ_OU_MAIS', rotulo: '10 ou mais' },
];

const OPCOES_LOCALIZACAO: { valor: LocalizacaoProducao; rotulo: string }[] = [
  { valor: 'BOM_REPOUSO', rotulo: 'Bom Repouso' },
  { valor: 'OUTRA_CIDADE', rotulo: 'Outra cidade' },
];

// Máscara visual só (separador de milhar pt-BR) — o valor guardado no state continua só
// dígitos, sem pontuação; a conversão pra número no envio (`Number(quantidadePes)`)
// nunca vê o ponto.
function formatarMilhar(digitos: string): string {
  return digitos === '' ? '' : Number(digitos).toLocaleString('pt-BR');
}

// Spec 25 — formulário de qualificação (Fluxo A): aparece uma vez, logo após o cadastro,
// antes de qualquer outra tela. As respostas definem o plano recomendado (quantidade de
// meeiros) e ficam vinculadas ao usuário pra uso futuro (pés de morango, localização).
export function OnboardingFormularioScreen({ navigation }: Props) {
  const { sair } = useAuth();
  const [faixaMeeiros, setFaixaMeeiros] = useState<FaixaMeeiros | null>(null);
  const [quantidadePes, setQuantidadePes] = useState('');
  const [localizacao, setLocalizacao] = useState<LocalizacaoProducao | null>(null);
  const [outraCidadeNome, setOutraCidadeNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precisaNomeCidade = localizacao === 'OUTRA_CIDADE';
  const preenchido =
    faixaMeeiros !== null &&
    quantidadePes.trim().length > 0 &&
    localizacao !== null &&
    (!precisaNomeCidade || outraCidadeNome.trim().length > 0);

  async function enviar() {
    if (!preenchido || !faixaMeeiros || !localizacao) return;
    setEnviando(true);
    setErro(null);
    try {
      const { planoRecomendado } = await onboardingRequest({
        faixaMeeiros,
        quantidadePes: Number(quantidadePes),
        localizacaoProducao: localizacao,
        localizacaoProducaoOutra: precisaNomeCidade ? outraCidadeNome.trim() : undefined,
      });
      navigation.replace('OnboardingPlano', { planoRecomendadoId: planoRecomendado.id });
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível enviar o formulário'));
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.titulo}>Conte sobre sua produção</Text>
          <Text style={styles.subtitulo}>Assim indicamos o plano certo pro tamanho da sua sociedade.</Text>
        </View>

        <View style={styles.pergunta}>
          <Text style={styles.label}>Quantos sócios meeiros você tem hoje?</Text>
          <View style={styles.opcoes}>
            {OPCOES_MEEIROS.map((opcao) => (
              <Pressable
                key={opcao.valor}
                style={[styles.opcao, faixaMeeiros === opcao.valor && styles.opcaoSelecionada]}
                onPress={() => setFaixaMeeiros(opcao.valor)}
              >
                <Text style={[styles.opcaoTexto, faixaMeeiros === opcao.valor && styles.opcaoTextoSelecionado]}>
                  {opcao.rotulo}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.pergunta}>
          <Text style={styles.label}>Número de pés de morango</Text>
          <View style={styles.campo}>
            <TextInput
              style={styles.input}
              placeholder="Ex: 5.000"
              placeholderTextColor={cores.stone[400]}
              keyboardType="number-pad"
              value={formatarMilhar(quantidadePes)}
              onChangeText={(valor) => setQuantidadePes(valor.replace(/\D/g, ''))}
            />
          </View>
        </View>

        <View style={styles.pergunta}>
          <Text style={styles.label}>Onde fica a produção?</Text>
          <View style={styles.opcoes}>
            {OPCOES_LOCALIZACAO.map((opcao) => (
              <Pressable
                key={opcao.valor}
                style={[styles.opcao, localizacao === opcao.valor && styles.opcaoSelecionada]}
                onPress={() => setLocalizacao(opcao.valor)}
              >
                <Text style={[styles.opcaoTexto, localizacao === opcao.valor && styles.opcaoTextoSelecionado]}>
                  {opcao.rotulo}
                </Text>
              </Pressable>
            ))}
          </View>
          {precisaNomeCidade && (
            <View style={styles.campo}>
              <TextInput
                style={styles.input}
                placeholder="Nome da cidade"
                placeholderTextColor={cores.stone[400]}
                autoFocus
                value={outraCidadeNome}
                onChangeText={setOutraCidadeNome}
              />
            </View>
          )}
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Pressable
          style={[styles.botaoPrimario, (!preenchido || enviando) && styles.botaoDesabilitado]}
          onPress={enviar}
          disabled={!preenchido || enviando}
        >
          {enviando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Ver plano recomendado</Text>}
        </Pressable>

        {/* Sem esse botão, quem cai aqui (formulário obrigatório de conta nova) ficava preso
            sem jeito de trocar de conta — mesmo gap já resolvido em AssinaturaBloqueioScreen
            (dev relatou, 2026-09-15), encontrado agora aqui também (dev relatou, 2026-09-18). */}
        <Pressable style={styles.botaoSair} onPress={() => sair()}>
          <LogOut size={18} color={cores.red.padrao} />
          <Text style={styles.textoBotaoSair}>Sair</Text>
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
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.xxl,
    paddingBottom: espacamento.xl,
    gap: espacamento.xl,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: cores.stone[900],
  },
  subtitulo: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    color: cores.stone[600],
    marginTop: espacamento.xs + 2,
  },
  pergunta: {
    gap: espacamento.sm + 2,
  },
  label: {
    fontSize: 13.5,
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
    paddingHorizontal: espacamento.xs,
    backgroundColor: '#FFFFFF',
  },
  opcaoSelecionada: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  opcaoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[600],
  },
  opcaoTextoSelecionado: {
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
  botaoDesabilitado: {
    opacity: 0.5,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoSair: {
    marginTop: espacamento.sm,
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
