import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { criarDespesaPessoal, editarDespesaPessoal, excluirDespesaPessoal } from '../lib/despesasPessoaisQueue';
import { DatePickerField } from '../components/DatePickerField';
import { mensagemErro } from '../lib/erroApi';
import { hojeISO } from '../lib/data';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { cores, espacamento, raio } from '../theme';
import type { TipoDespesa } from '../types/despesa';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NovaDespesaPessoal'>;

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

// Máscara "estilo Pix", mesmo padrão de NovaDespesaScreen.tsx.
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

// Mobile 07 — criar/editar despesa pessoal, equivalente à
// frontend/src/pages/NovaDespesaPessoalPage.tsx do web. Sem rateio, sem sócio, sem foto de
// comprovante — sempre 100% de quem lançou (docs/specs/mobile/07-despesa-pessoal.md).
export function NovaDespesaPessoalScreen({ navigation, route }: Props) {
  const { safraId, despesaPessoal } = route.params;
  const emEdicao = !!despesaPessoal;

  const [tipo, setTipo] = useState<TipoDespesa>(despesaPessoal?.tipo ?? 'OUTRO');
  const [descricao, setDescricao] = useState(despesaPessoal?.descricao ?? '');
  const [valorCentavos, setValorCentavos] = useState(
    despesaPessoal ? String(Math.round(Number(despesaPessoal.valor) * 100)) : ''
  );
  const [data, setData] = useState(despesaPessoal?.data.slice(0, 10) ?? hojeISO());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  function alterarValor(texto: string) {
    setValorCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;
  const formValido = valorCentavos !== '' && valorNumero > 0 && !!data;

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      const input = { tipo, valor: valorNumero, data, descricao: descricao.trim() || undefined };
      if (emEdicao && despesaPessoal) {
        await editarDespesaPessoal(safraId, despesaPessoal, input);
      } else {
        await criarDespesaPessoal(safraId, input);
      }
      navigation.goBack();
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível salvar a despesa'));
      setSalvando(false);
    }
  }

  function excluir() {
    if (!despesaPessoal) return;
    Alert.alert('Excluir despesa pessoal?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setErro(null);
          setExcluindo(true);
          try {
            await excluirDespesaPessoal(despesaPessoal);
            navigation.goBack();
          } catch (e) {
            setErro(mensagemErro(e, 'Não foi possível excluir a despesa'));
            setExcluindo(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>{emEdicao ? 'Editar despesa pessoal' : 'Nova despesa pessoal'}</Text>
        {emEdicao ? (
          <Pressable
            style={styles.botaoVoltar}
            onPress={excluir}
            disabled={excluindo}
            hitSlop={8}
            accessibilityLabel="Excluir despesa"
          >
            <Trash2 size={17} color={cores.red.padrao} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <View style={styles.botaoVoltar} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        {erro && <Text style={styles.erro}>{erro}</Text>}

        <View>
          <Text style={styles.label}>Tipo de despesa</Text>
          <View style={styles.gradeTipos}>
            {TIPOS_DESPESA.map((t) => {
              const Icone = ICONE_TIPO_DESPESA[t];
              const ativo = t === tipo;
              return (
                <Pressable key={t} style={[styles.tipoItem, ativo && styles.tipoItemAtivo]} onPress={() => setTipo(t)}>
                  <View style={[styles.tipoIcone, ativo && styles.tipoIconeAtivo]}>
                    <Icone size={17} color={ativo ? cores.green[700] : cores.stone[600]} />
                  </View>
                  <Text style={styles.tipoTexto}>{ROTULO_TIPO_DESPESA[t]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.label, { textAlign: 'center' }]}>Valor</Text>
          <View style={styles.valorLinha}>
            <Text style={styles.valorPrefixo}>R$</Text>
            <TextInput
              style={styles.valorInput}
              value={formatarValorMascara(valorCentavos)}
              onChangeText={alterarValor}
              placeholder="0,00"
              placeholderTextColor={cores.stone[400]}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View>
          <Text style={styles.label}>Data</Text>
          <DatePickerField value={data} onChange={setData} />
        </View>

        <View>
          <Text style={styles.label}>Descrição (opcional)</Text>
          <TextInput
            style={styles.input}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Do que foi esse gasto?"
            placeholderTextColor={cores.stone[400]}
            maxLength={140}
          />
        </View>

        <View style={styles.aviso}>
          <ShieldCheck size={17} color={cores.green[700]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.avisoTitulo}>Visível só para você</Text>
            <Text style={styles.avisoTexto}>Não entra na divisão de lucro nem no extrato da sociedade</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <Pressable
          style={[styles.botaoPrimario, (!formValido || salvando) && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={!formValido || salvando}
        >
          {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Salvar despesa</Text>}
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
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  gradeTipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacamento.sm,
  },
  tipoItem: {
    width: '22%',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.sm + 4,
    backgroundColor: '#FFFFFF',
  },
  tipoItemAtivo: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  tipoIcone: {
    width: 32,
    height: 32,
    borderRadius: raio.sm + 2,
    backgroundColor: cores.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipoIconeAtivo: {
    backgroundColor: '#FFFFFF',
  },
  tipoTexto: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: cores.stone[700],
  },
  valorLinha: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacamento.xs + 2,
    borderBottomWidth: 2,
    borderBottomColor: cores.linha,
    paddingVertical: espacamento.sm + 4,
  },
  valorPrefixo: {
    fontSize: 22,
    fontWeight: '700',
    color: cores.stone[400],
  },
  valorInput: {
    minWidth: 160,
    fontSize: 36,
    fontWeight: '800',
    color: cores.stone[900],
    padding: 0,
  },
  input: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    fontSize: 13.5,
    fontWeight: '500',
    color: cores.stone[900],
    backgroundColor: '#FFFFFF',
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm + 2,
    backgroundColor: cores.green[100],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  avisoTitulo: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  avisoTexto: {
    marginTop: 2,
    fontSize: 11.5,
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
