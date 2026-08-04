import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, ShieldCheck, WifiOff } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { criarAcertoRequest, listarAcertosRequest } from '../services/acertos';
import { buscarSimulacaoPersonalizadaRequest } from '../services/simulacao';
import { useConectividade } from '../lib/useConectividade';
import { useSafraAtiva } from '../context/SafraContext';
import { mensagemErro } from '../lib/erroApi';
import { adicionarDias, formatarData } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { DatePickerField } from '../components/DatePickerField';
import { cores, espacamento, raio } from '../theme';
import type { TipoAcerto } from '../types/acerto';
import type { Simulacao } from '../types/simulacao';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'NovoAcerto'>;

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Registrar acerto, equivalente à frontend/src/pages/NovoAcertoPage.tsx do web — exige conexão
// o tempo todo (nunca entra na fila de sincronização genérica, mesmo critério de sociedade/
// safra): é uma ação rara que depende de validação imediata do servidor (sobreposição de
// período, status da safra). docs/specs/mobile/05-painel-e-acerto.md, critério de aceite 8.
export function NovoAcertoScreen({ navigation, route }: Props) {
  const { safraId } = route.params;
  const conectado = useConectividade();
  const { safraAtiva, selecionarSafra } = useSafraAtiva();

  const [tipo, setTipo] = useState<TipoAcerto>('PARCIAL');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState(hojeISO());
  const [sugestaoLabel, setSugestaoLabel] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const formValido = !!dataInicio && !!dataFim && dataInicio <= dataFim;

  useEffect(() => {
    if (!conectado) return;
    listarAcertosRequest(safraId)
      .then((acertos) => {
        if (acertos.length > 0) {
          const inicioSugerido = adicionarDias(acertos[0].data_fim, 1);
          setDataInicio(inicioSugerido);
          setSugestaoLabel(`Sugerido a partir do último acerto (${formatarData(acertos[0].data_fim)})`);
        } else if (safraAtiva?.safra.data_inicio) {
          setDataInicio(safraAtiva.safra.data_inicio.slice(0, 10));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safraId, conectado]);

  useEffect(() => {
    if (!conectado || !dataInicio || !dataFim || dataInicio > dataFim) {
      setSimulacao(null);
      return;
    }
    buscarSimulacaoPersonalizadaRequest(safraId, dataInicio, dataFim)
      .then(setSimulacao)
      .catch(() => setErro('Não foi possível calcular a prévia do período'));
  }, [safraId, dataInicio, dataFim, conectado]);

  async function confirmar() {
    if (!formValido || !dataInicio || !dataFim) return;
    setErro(null);
    setSalvando(true);
    try {
      const acerto = await criarAcertoRequest(safraId, { data_inicio: dataInicio, data_fim: dataFim, tipo });
      if (tipo === 'FINAL' && safraAtiva) {
        selecionarSafra({ ...safraAtiva, safra: { ...safraAtiva.safra, status: 'ENCERRADA' } });
      }
      navigation.replace('AcertoDetalhe', { acertoId: acerto.id, safraId });
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível registrar o acerto'));
      setSalvando(false);
    }
  }

  if (!conectado) {
    return (
      <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
        <View style={styles.cabecalho}>
          <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
            <ArrowLeft size={18} color={cores.stone[900]} />
          </Pressable>
          <Text style={styles.tituloCabecalho}>Registrar acerto</Text>
          <View style={styles.botaoVoltar} />
        </View>
        <View style={styles.semConexao}>
          <WifiOff size={28} color={cores.stone[600]} />
          <Text style={styles.semConexaoTitulo}>É preciso estar conectado</Text>
          <Text style={styles.semConexaoTexto}>
            Registrar um acerto depende de validação imediata do servidor — não é possível salvar essa ação
            localmente para sincronizar depois. Conecte-se à internet e tente novamente.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Registrar acerto</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}

        <View>
          <Text style={styles.label}>Tipo de acerto</Text>
          <View style={styles.linhaChips}>
            <Pressable style={[styles.chip, tipo === 'PARCIAL' && styles.chipAtivo]} onPress={() => setTipo('PARCIAL')}>
              <Text style={[styles.chipTexto, tipo === 'PARCIAL' && styles.chipTextoAtivo]}>Parcial</Text>
            </Pressable>
            <Pressable style={[styles.chip, tipo === 'FINAL' && styles.chipAtivo]} onPress={() => setTipo('FINAL')}>
              <Text style={[styles.chipTexto, tipo === 'FINAL' && styles.chipTextoAtivo]}>
                Final (encerra a safra)
              </Text>
            </Pressable>
          </View>
        </View>

        {tipo === 'FINAL' && (
          <View style={styles.aviso}>
            <AlertTriangle size={17} color={cores.amber.padrao} />
            <View style={{ flex: 1 }}>
              <Text style={styles.avisoTitulo}>Isso também encerra a safra</Text>
              <Text style={styles.avisoTexto}>
                Depois de um acerto final, não é mais possível lançar despesas ou vendas nessa safra.
              </Text>
            </View>
          </View>
        )}

        <View>
          <Text style={styles.label}>Período</Text>
          <View style={styles.linhaDatas}>
            <DatePickerField value={dataInicio} onChange={setDataInicio} placeholder="Início" />
            <DatePickerField value={dataFim} onChange={setDataFim} placeholder="Fim" />
          </View>
          {sugestaoLabel && <Text style={styles.legenda}>{sugestaoLabel}</Text>}
          {dataInicio && dataFim && dataInicio > dataFim && (
            <Text style={styles.erroCampo}>A data de início precisa ser antes (ou igual) à data de fim</Text>
          )}
        </View>

        {simulacao && (
          <>
            <View style={styles.previaCaixa}>
              <Text style={styles.previaLabel}>Lucro líquido do período</Text>
              <Text style={[styles.previaValor, simulacao.lucroLiquido < 0 && { color: cores.red.padrao }]}>
                {formatarMoeda(simulacao.lucroLiquido)}
              </Text>
              <View style={styles.previaLinha}>
                <Text style={styles.previaDetalhe}>Receita: {formatarMoeda(simulacao.receita)}</Text>
                <Text style={styles.previaDetalhe}>Despesas: {formatarMoeda(simulacao.despesas)}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Divisão por sócio</Text>
              {simulacao.divisao.map((d) => (
                <View key={d.socio_id} style={styles.linhaDivisao}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTexto}>{iniciais(d.nome)}</Text>
                  </View>
                  <Text style={styles.linhaDivisaoNome}>{d.nome}</Text>
                  <Text style={[styles.linhaDivisaoValor, d.valor < 0 && { color: cores.red.padrao }]}>
                    {formatarMoeda(d.valor)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.info}>
          <ShieldCheck size={17} color={cores.stone[600]} />
          <Text style={styles.infoTexto}>
            Ao confirmar, esses valores ficam congelados para esse período. Despesas e vendas lançadas depois
            não vão alterar esse extrato.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <Pressable
          style={[styles.botaoPrimario, (!formValido || salvando) && styles.botaoDesabilitado]}
          onPress={confirmar}
          disabled={!formValido || salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoPrimario}>
              Confirmar acerto {tipo === 'FINAL' ? 'final' : 'parcial'}
            </Text>
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
  semConexao: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    paddingHorizontal: espacamento.xxl,
  },
  semConexaoTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
  },
  semConexaoTexto: {
    fontSize: 13,
    color: cores.stone[600],
    textAlign: 'center',
    lineHeight: 19,
  },
  conteudo: {
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.md,
    paddingBottom: espacamento.xl,
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
  linhaChips: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
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
  aviso: {
    flexDirection: 'row',
    gap: espacamento.sm,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 6,
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
  linhaDatas: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  legenda: {
    marginTop: espacamento.xs + 2,
    fontSize: 11.5,
    color: cores.stone[400],
  },
  erroCampo: {
    marginTop: espacamento.xs + 2,
    fontSize: 11.5,
    fontWeight: '500',
    color: cores.red.padrao,
  },
  previaCaixa: {
    backgroundColor: cores.cream[100],
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.lg,
  },
  previaLabel: {
    fontSize: 12,
    color: cores.stone[600],
  },
  previaValor: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '800',
    color: cores.stone[900],
  },
  previaLinha: {
    flexDirection: 'row',
    gap: espacamento.lg,
    marginTop: espacamento.sm,
  },
  previaDetalhe: {
    fontSize: 11.5,
    color: cores.stone[600],
  },
  linhaDivisao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: cores.cream[100],
    paddingVertical: espacamento.sm + 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: raio.pill,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    fontSize: 12,
    fontWeight: '800',
    color: cores.green[800],
  },
  linhaDivisaoNome: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  linhaDivisaoValor: {
    fontSize: 14.5,
    fontWeight: '800',
    color: cores.green[800],
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
