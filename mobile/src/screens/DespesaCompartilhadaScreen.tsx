import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listarMinhasSafrasRequest } from '../services/safras';
import { criarDespesaCompartilhadaRequest } from '../services/despesas';
import { DatePickerField } from '../components/DatePickerField';
import { mensagemErro } from '../lib/erroApi';
import { hojeISO } from '../lib/data';
import { ROTULO_TIPO_DESPESA } from '../lib/rotulos';
import { ICONE_TIPO_DESPESA } from '../lib/iconesTipoDespesa';
import { cores, espacamento, raio } from '../theme';
import type { TipoDespesa } from '../types/despesa';
import type { MinhaSafra } from '../types/safra';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DespesaCompartilhada'>;

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

// Mobile 11 (docs/specs/mobile/11-despesa-compartilhada.md) — equivalente à
// frontend/src/pages/NovaDespesaCompartilhadaPage.tsx do web. Fora da casca de navegação
// (como Acertos/Sócios), alcançada pelo item de resumo consolidado da tela de Início.
export function DespesaCompartilhadaScreen({ navigation }: Props) {
  const [safras, setSafras] = useState<MinhaSafra[]>([]);
  const [carregandoSafras, setCarregandoSafras] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [descricao, setDescricao] = useState('');
  const [valorCentavos, setValorCentavos] = useState('');
  const [data, setData] = useState(hojeISO());
  const [modoRateio, setModoRateio] = useState<'igual' | 'percentual'>('igual');
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarMinhasSafrasRequest()
      .then((res) => setSafras(res.safras.filter((s) => s.status === 'EM_ANDAMENTO')))
      .catch(() => setErro('Não foi possível carregar suas safras'))
      .finally(() => setCarregandoSafras(false));
  }, []);

  function alternarSafra(id: string) {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  }

  function alterarValor(texto: string) {
    setValorCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  const idsSelecionados = useMemo(() => Array.from(selecionadas), [selecionadas]);
  const valorNumero = valorCentavos ? Number(valorCentavos) / 100 : 0;

  const somaPercentuais = useMemo(
    () => idsSelecionados.reduce((acc, id) => acc + (Number(percentuais[id]?.replace(',', '.')) || 0), 0),
    [idsSelecionados, percentuais]
  );

  const rateioValido =
    modoRateio === 'igual' || (idsSelecionados.length > 0 && Math.abs(somaPercentuais - 100) <= 0.01);

  const formValido = idsSelecionados.length >= 2 && valorNumero > 0 && !!data && rateioValido;

  async function salvar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarDespesaCompartilhadaRequest({
        safra_ids: idsSelecionados,
        tipo,
        valor_total: valorNumero,
        data,
        descricao: descricao.trim() || undefined,
        rateio:
          modoRateio === 'igual'
            ? { modo: 'igual' }
            : {
                modo: 'percentual',
                percentuais: idsSelecionados.map((id) => ({
                  safra_id: id,
                  percentual: Number(percentuais[id]?.replace(',', '.')) || 0,
                })),
              },
      });
      navigation.goBack();
    } catch (e) {
      setErro(mensagemErro(e, 'Não foi possível lançar a despesa compartilhada'));
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Despesa compartilhada</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        {erro && <Text style={styles.erro}>{erro}</Text>}
        <Text style={styles.intro}>
          Lance um custo que serve pra mais de uma safra ao mesmo tempo (ex: um insumo usado na terra
          toda) — o valor é dividido e vira uma despesa normal em cada uma.
        </Text>

        <View>
          <Text style={styles.label}>Quais safras participam?</Text>
          {carregandoSafras && <ActivityIndicator style={{ marginTop: espacamento.sm }} />}
          {!carregandoSafras && safras.length < 2 && (
            <Text style={styles.legenda}>Você precisa de pelo menos 2 safras ativas pra usar isso.</Text>
          )}
          <View style={{ gap: espacamento.sm }}>
            {safras.map((s) => {
              const ativo = selecionadas.has(s.id);
              return (
                <Pressable
                  key={s.id}
                  style={[styles.itemSafra, ativo && styles.itemSafraAtivo]}
                  onPress={() => alternarSafra(s.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemSafraNome}>{s.nome}</Text>
                    <Text style={styles.itemSafraSociedade}>{s.sociedade_nome}</Text>
                  </View>
                  <View style={[styles.checkbox, ativo && styles.checkboxAtivo]}>
                    {ativo && <View style={styles.checkboxMiolo} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

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

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.label, { textAlign: 'center' }]}>Valor total</Text>
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
          <Text style={styles.label}>Como ratear?</Text>
          <View style={styles.opcoesModo}>
            <Pressable
              style={[styles.opcaoModo, modoRateio === 'igual' && styles.opcaoModoAtiva]}
              onPress={() => setModoRateio('igual')}
            >
              <Text style={[styles.opcaoModoTexto, modoRateio === 'igual' && styles.opcaoModoTextoAtivo]}>
                Igualmente
              </Text>
            </Pressable>
            <Pressable
              style={[styles.opcaoModo, modoRateio === 'percentual' && styles.opcaoModoAtiva]}
              onPress={() => setModoRateio('percentual')}
            >
              <Text style={[styles.opcaoModoTexto, modoRateio === 'percentual' && styles.opcaoModoTextoAtivo]}>
                Percentual customizado
              </Text>
            </Pressable>
          </View>

          {modoRateio === 'percentual' && idsSelecionados.length > 0 && (
            <View style={{ marginTop: espacamento.sm + 2, gap: espacamento.sm }}>
              {idsSelecionados.map((id) => {
                const safra = safras.find((s) => s.id === id);
                return (
                  <View key={id} style={styles.linhaPercentual}>
                    <Text style={styles.linhaPercentualTexto} numberOfLines={1}>
                      {safra?.nome} · {safra?.sociedade_nome}
                    </Text>
                    <View style={styles.percentualCampo}>
                      <TextInput
                        style={styles.percentualInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={cores.stone[400]}
                        value={percentuais[id] ?? ''}
                        onChangeText={(texto) =>
                          setPercentuais((atual) => ({ ...atual, [id]: texto.replace(/[^\d,]/g, '') }))
                        }
                      />
                      <Text style={styles.percentualSimbolo}>%</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={[styles.somaPercentual, Math.abs(somaPercentuais - 100) <= 0.01 && styles.somaPercentualOk]}>
                Soma: {somaPercentuais.toFixed(2)}% (precisa fechar em 100%)
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <Pressable
          style={[styles.botaoPrimario, (!formValido || salvando) && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={!formValido || salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoPrimario}>Lançar despesa compartilhada</Text>
          )}
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
  intro: {
    fontSize: 12.5,
    color: cores.stone[600],
    lineHeight: 17,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  legenda: {
    fontSize: 13,
    color: cores.stone[600],
  },
  itemSafra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: '#FFFFFF',
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  itemSafraAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[100],
  },
  itemSafraNome: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.stone[900],
  },
  itemSafraSociedade: {
    marginTop: 1,
    fontSize: 12,
    color: cores.stone[600],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: raio.pill,
    borderWidth: 2,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  checkboxMiolo: {
    width: 8,
    height: 8,
    borderRadius: raio.pill,
    backgroundColor: '#FFFFFF',
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
  opcoesModo: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  opcaoModo: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingVertical: espacamento.sm + 2,
    backgroundColor: '#FFFFFF',
  },
  opcaoModoAtiva: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  opcaoModoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[700],
  },
  opcaoModoTextoAtivo: {
    color: '#FFFFFF',
  },
  linhaPercentual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacamento.sm,
  },
  linhaPercentualTexto: {
    flex: 1,
    fontSize: 12.5,
    color: cores.stone[700],
  },
  percentualCampo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentualInput: {
    width: 56,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.sm,
    paddingVertical: espacamento.xs + 2,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  percentualSimbolo: {
    fontSize: 12.5,
    color: cores.stone[600],
  },
  somaPercentual: {
    textAlign: 'right',
    fontSize: 11.5,
    fontWeight: '700',
    color: cores.red.padrao,
  },
  somaPercentualOk: {
    color: cores.green[700],
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
