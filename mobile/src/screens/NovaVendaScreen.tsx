import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, Minus, Plus, Store, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useConectividade } from '../lib/useConectividade';
import { obterUnidadesVendaCache, salvarUnidadesVendaCache } from '../lib/unidadesVendaCache';
import { listarUnidadesRequest } from '../services/unidadesVenda';
import { TelaComTeclado } from '../components/TelaComTeclado';
import { obterRegrasCache, salvarRegrasCache } from '../lib/regrasCache';
import { listarRegrasRequest } from '../services/regrasDespesaRecorrente';
import { criarVenda, editarVenda, excluirVenda } from '../lib/vendasQueue';
import { formatarMoeda } from '../lib/formatacao';
import { cores, espacamento, raio } from '../theme';
import type { UnidadeVenda } from '../types/unidadeVenda';
import type { RegraDespesaRecorrente } from '../types/regraDespesaRecorrente';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NovaVenda'>;

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Máscara "estilo Pix" — mesma lógica de NovaDespesaScreen.tsx.
function formatarValorMascara(digitos: string): string {
  if (!digitos) return '';
  const [inteiro, decimal] = (Number(digitos) / 100).toFixed(2).split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiroComPontos},${decimal}`;
}

function dataParaExibicao(iso: string): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function exibicaoParaData(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  const dia = digitos.slice(0, 2);
  const mes = digitos.slice(2, 4);
  const ano = digitos.slice(4, 8);
  return `${ano}-${mes}-${dia}`;
}

// Tela de criação/edição de venda — equivalente à frontend/src/pages/NovaVendaPage.tsx do web.
// Diferente do web, sempre escreve através do cache local + fila de sincronização
// (mobile/src/lib/vendasQueue.ts): funciona sem internet por padrão (docs/specs/mobile/
// 06-vendas-e-despesa-recorrente.md).
export function NovaVendaScreen({ navigation, route }: Props) {
  const { safraId, sociedadeId, venda } = route.params;
  const emEdicao = !!venda;
  const conectado = useConectividade();

  const [unidades, setUnidades] = useState<UnidadeVenda[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(true);
  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);

  const [unidadeId, setUnidadeId] = useState(venda?.unidade_id ?? '');
  const [regrasMarcadas, setRegrasMarcadas] = useState<string[]>(venda?.regras_aplicadas ?? []);
  const unidadeDosTogglesRef = useRef<string | null>(venda?.unidade_id ?? null);

  const [outraData, setOutraData] = useState(venda ? venda.data.slice(0, 10) !== hojeISO() : false);
  const [data, setData] = useState(venda?.data.slice(0, 10) ?? hojeISO());
  const [textoData, setTextoData] = useState(venda ? dataParaExibicao(venda.data.slice(0, 10)) : '');
  const [quantidadeTexto, setQuantidadeTexto] = useState(venda?.quantidade ?? '1');
  const [precoCentavos, setPrecoCentavos] = useState(venda ? String(Math.round(Number(venda.preco) * 100)) : '');
  const [comprador, setComprador] = useState(venda?.comprador ?? '');
  const [pago, setPago] = useState(venda?.pago ?? false);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const salvandoRef = useRef(false);

  const travadaPorAcerto = venda?.coberta_por_acerto ?? false;

  useEffect(() => {
    (async () => {
      const cacheUnidades = await obterUnidadesVendaCache(sociedadeId);
      if (cacheUnidades.length > 0) {
        setUnidades(cacheUnidades);
        if (!emEdicao && !unidadeId) {
          const primeiraAtiva = cacheUnidades.find((u) => u.ativo);
          if (primeiraAtiva) setUnidadeId(primeiraAtiva.id);
        }
        setCarregandoUnidades(false);
      }
      const cacheRegras = await obterRegrasCache(sociedadeId);
      if (cacheRegras.length > 0) setRegras(cacheRegras);

      try {
        const [resUnidades, resRegras] = await Promise.all([
          listarUnidadesRequest(sociedadeId),
          listarRegrasRequest(sociedadeId),
        ]);
        await salvarUnidadesVendaCache(sociedadeId, resUnidades.unidades);
        await salvarRegrasCache(sociedadeId, resRegras.regras);
        setUnidades(resUnidades.unidades);
        setRegras(resRegras.regras);
        if (!emEdicao && !unidadeId) {
          const primeiraAtiva = resUnidades.unidades.find((u) => u.ativo);
          if (primeiraAtiva) setUnidadeId(primeiraAtiva.id);
        }
      } catch {
        // offline: segue só com o que já estava em cache (ou vazio, tratado abaixo)
      } finally {
        setCarregandoUnidades(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociedadeId]);

  const regrasPorVenda = regras.filter((r) => r.tipo_gatilho === 'POR_VENDA' && r.ativo);
  const regrasAplicaveis = regrasPorVenda.filter((r) => r.unidade_id === unidadeId);

  // Trocar de unidade reseta os toggles pro padrão marcado; ao editar, o efeito não
  // sobrescreve o que já veio de `venda.regras_aplicadas` (mesmo padrão de NovaVendaPage.tsx web).
  useEffect(() => {
    if (carregandoUnidades) return;
    if (unidadeDosTogglesRef.current === unidadeId) return;
    unidadeDosTogglesRef.current = unidadeId;
    setRegrasMarcadas(regrasAplicaveis.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeId, regras, carregandoUnidades]);

  function alternarRegra(regraId: string) {
    setRegrasMarcadas((atual) => (atual.includes(regraId) ? atual.filter((id) => id !== regraId) : [...atual, regraId]));
  }

  function alterarPreco(texto: string) {
    setPrecoCentavos(texto.replace(/\D/g, '').slice(0, 9));
  }

  function alterarQuantidade(texto: string) {
    setQuantidadeTexto(texto.replace(/\D/g, '').slice(0, 4));
  }

  function alterarTextoData(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 8);
    let formatado = digitos;
    if (digitos.length > 4) formatado = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    else if (digitos.length > 2) formatado = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    setTextoData(formatado);
    const iso = exibicaoParaData(digitos);
    if (iso) setData(iso);
  }

  const quantidade = Number(quantidadeTexto) || 0;
  const precoNumero = precoCentavos ? Number(precoCentavos) / 100 : 0;
  const total = quantidade * precoNumero;
  const unidadeSelecionada = unidades.find((u) => u.id === unidadeId);
  const dataValida = outraData ? !!exibicaoParaData(textoData) : true;
  const formValido = quantidade > 0 && precoNumero > 0 && dataValida && !!unidadeId;

  async function salvar() {
    if (!formValido || salvandoRef.current) return;
    salvandoRef.current = true;
    setErro(null);
    setSalvando(true);
    try {
      const input = {
        data,
        quantidade,
        preco: precoNumero,
        comprador: comprador.trim() || undefined,
        unidade_id: unidadeId,
        pago,
        regras_por_venda_aplicadas: regrasMarcadas,
      };
      const unidadeNome = unidadeSelecionada?.nome ?? '';

      if (emEdicao && venda) {
        await editarVenda(safraId, venda, input, unidadeNome);
      } else {
        await criarVenda(safraId, input, unidadeNome);
      }
      navigation.goBack();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a venda');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!venda) return;
    Alert.alert('Excluir venda?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setExcluindo(true);
          try {
            await excluirVenda(safraId, venda);
            navigation.goBack();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Não foi possível excluir a venda');
            setExcluindo(false);
          }
        },
      },
    ]);
  }

  const semUnidadesEmCache = !carregandoUnidades && unidades.length === 0;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <TelaComTeclado>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>{emEdicao ? 'Editar venda' : 'Nova venda'}</Text>
        {emEdicao ? (
          <Pressable
            style={styles.botaoVoltar}
            onPress={excluir}
            disabled={excluindo || travadaPorAcerto}
            hitSlop={8}
            accessibilityLabel="Excluir venda"
          >
            <Trash2 size={17} color={travadaPorAcerto ? cores.stone[400] : cores.red.padrao} />
          </Pressable>
        ) : (
          <View style={styles.botaoVoltar} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {travadaPorAcerto && (
          <View style={styles.aviso}>
            <AlertTriangle size={16} color={cores.amber.padrao} />
            <Text style={styles.avisoTexto}>
              Essa venda já faz parte de um acerto registrado, então não pode mais ser editada ou excluída.
            </Text>
          </View>
        )}

        {carregandoUnidades && unidades.length === 0 && <ActivityIndicator />}

        {semUnidadesEmCache && (
          <View style={styles.aviso}>
            <AlertTriangle size={16} color={cores.amber.padrao} />
            <Text style={styles.avisoTexto}>
              {conectado
                ? 'Não foi possível carregar as unidades de venda.'
                : 'Nenhuma unidade de venda salva neste aparelho ainda — conecte-se à internet pelo menos uma vez antes de lançar vendas.'}
            </Text>
          </View>
        )}

        {!semUnidadesEmCache && !travadaPorAcerto && (
          <>
            <View>
              <Text style={styles.label}>Data</Text>
              <View style={styles.linhaChips}>
                <Pressable
                  style={[styles.chip, !outraData && styles.chipAtivo]}
                  onPress={() => {
                    setOutraData(false);
                    setData(hojeISO());
                  }}
                >
                  <Text style={[styles.chipTexto, !outraData && styles.chipTextoAtivo]}>Hoje</Text>
                </Pressable>
                <Pressable style={[styles.chip, outraData && styles.chipAtivo]} onPress={() => setOutraData(true)}>
                  <Text style={[styles.chipTexto, outraData && styles.chipTextoAtivo]}>Outra data</Text>
                </Pressable>
              </View>
              {outraData && (
                <TextInput
                  style={[styles.input, { marginTop: espacamento.sm }]}
                  value={textoData}
                  onChangeText={alterarTextoData}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={cores.stone[400]}
                  keyboardType="numeric"
                />
              )}
            </View>

            {unidades.length > 1 && (
              <View>
                <Text style={styles.label}>Unidade</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.linhaChips}>
                    {unidades
                      .filter((u) => u.ativo || u.id === unidadeId)
                      .map((u) => {
                        const ativo = u.id === unidadeId;
                        return (
                          <Pressable
                            key={u.id}
                            style={[styles.chip, ativo && styles.chipAtivo]}
                            onPress={() => setUnidadeId(u.id)}
                          >
                            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{u.nome}</Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.label, { textAlign: 'center' }]}>
                Quantidade{unidadeSelecionada ? ` (${unidadeSelecionada.nome})` : ''}
              </Text>
              <View style={styles.quantidadeLinha}>
                <Pressable
                  style={styles.stepperBotaoGrande}
                  onPress={() => setQuantidadeTexto(String(Math.max(1, quantidade - 1)))}
                  disabled={quantidade <= 1}
                  hitSlop={6}
                  accessibilityLabel="Diminuir quantidade"
                >
                  <Minus size={18} color={cores.green[800]} strokeWidth={2.4} />
                </Pressable>
                <View style={{ alignItems: 'center', minWidth: 74 }}>
                  <TextInput
                    style={styles.quantidadeInput}
                    value={quantidadeTexto}
                    onChangeText={alterarQuantidade}
                    keyboardType="numeric"
                  />
                  <Text style={styles.quantidadeUnidade}>{unidadeSelecionada?.nome ?? 'unidades'}</Text>
                </View>
                <Pressable
                  style={styles.stepperBotaoGrande}
                  onPress={() => setQuantidadeTexto(String(quantidade + 1))}
                  hitSlop={6}
                  accessibilityLabel="Aumentar quantidade"
                >
                  <Plus size={18} color={cores.green[800]} strokeWidth={2.4} />
                </Pressable>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Preço por {unidadeSelecionada?.nome.toLowerCase() ?? 'unidade'}</Text>
              <View style={styles.valorLinha}>
                <Text style={styles.valorPrefixo}>R$</Text>
                <TextInput
                  style={styles.valorInput}
                  value={formatarValorMascara(precoCentavos)}
                  onChangeText={alterarPreco}
                  placeholder="0,00"
                  placeholderTextColor={cores.stone[400]}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total da venda</Text>
              <Text style={styles.totalValor}>{formatarMoeda(total)}</Text>
            </View>

            <View>
              <Text style={styles.label}>Comprador (opcional)</Text>
              <View style={styles.inputComIcone}>
                <Store size={18} color={cores.green[700]} />
                <TextInput
                  style={styles.inputComIconeTexto}
                  value={comprador}
                  onChangeText={setComprador}
                  placeholder="Ex: Ceasa Betim, Sacolão do Zé..."
                  placeholderTextColor={cores.stone[400]}
                />
              </View>
            </View>

            <View style={styles.linhaToggle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitulo}>Já foi pago?</Text>
                <Text style={styles.toggleSub}>Se o comprador ainda não pagou, deixe desmarcado e edite depois</Text>
              </View>
              <Switch
                value={pago}
                onValueChange={setPago}
                trackColor={{ false: cores.cream[100], true: cores.green[800] }}
                thumbColor="#FFFFFF"
              />
            </View>

            {regrasAplicaveis.length > 0 && (
              <View style={{ gap: espacamento.sm }}>
                <Text style={styles.avisoRegras}>
                  Despesa recorrente aplicável a essa venda — desmarque se ela não deve ser lançada dessa vez
                </Text>
                {regrasAplicaveis.map((regra) => {
                  const marcada = regrasMarcadas.includes(regra.id);
                  const valorRegra = Number(regra.valor) * quantidade;
                  return (
                    <View key={regra.id} style={styles.linhaToggle}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleTitulo}>
                          {formatarMoeda(valorRegra)} ({formatarMoeda(Number(regra.valor))}/
                          {unidadeSelecionada?.nome.toLowerCase() ?? 'unidade'})
                        </Text>
                        <Text style={styles.toggleSub}>Despesa gerada automaticamente ao salvar</Text>
                      </View>
                      <Switch
                        value={marcada}
                        onValueChange={() => alternarRegra(regra.id)}
                        trackColor={{ false: cores.cream[100], true: cores.green[800] }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!travadaPorAcerto && !semUnidadesEmCache && (
        <View style={styles.rodape}>
          <Pressable
            style={[styles.botaoPrimario, (!formValido || salvando) && styles.botaoDesabilitado]}
            onPress={salvar}
            disabled={!formValido || salvando}
          >
            {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.textoBotaoPrimario}>Salvar venda</Text>}
          </Pressable>
        </View>
      )}
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
    alignItems: 'flex-start',
    gap: espacamento.sm,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.lg,
    padding: espacamento.md,
  },
  avisoTexto: {
    flex: 1,
    fontSize: 12,
    color: cores.amber.padrao,
    lineHeight: 17,
  },
  avisoRegras: {
    fontSize: 11.5,
    color: cores.stone[600],
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  linhaChips: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
    backgroundColor: '#FFFFFF',
  },
  chipAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  chipTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[700],
  },
  chipTextoAtivo: {
    color: '#FFFFFF',
  },
  quantidadeLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xl,
    paddingVertical: espacamento.xs,
  },
  stepperBotaoGrande: {
    width: 44,
    height: 44,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantidadeInput: {
    minWidth: 74,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '800',
    color: cores.stone[900],
    padding: 0,
  },
  quantidadeUnidade: {
    fontSize: 11,
    color: cores.stone[400],
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
  inputComIcone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
    backgroundColor: '#FFFFFF',
  },
  inputComIconeTexto: {
    flex: 1,
    fontSize: 13.5,
    color: cores.stone[900],
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
    fontSize: 18,
    fontWeight: '700',
    color: cores.stone[400],
  },
  valorInput: {
    minWidth: 120,
    fontSize: 26,
    fontWeight: '800',
    color: cores.stone[900],
    padding: 0,
  },
  totalBox: {
    backgroundColor: cores.cream[100],
    borderRadius: raio.lg,
    paddingVertical: espacamento.md + 4,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: cores.stone[600],
  },
  totalValor: {
    fontSize: 24,
    fontWeight: '800',
    color: cores.stone[900],
    marginTop: 2,
  },
  linhaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.md,
  },
  toggleTitulo: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  toggleSub: {
    fontSize: 11.3,
    color: cores.stone[600],
    marginTop: 2,
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
