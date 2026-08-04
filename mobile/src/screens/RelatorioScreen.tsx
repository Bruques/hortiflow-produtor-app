import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, FileDown, WifiOff } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { baixarECompartilharRelatorioRequest, type FiltroRelatorio } from '../services/relatorio';
import { useConectividade } from '../lib/useConectividade';
import { useSafraAtiva } from '../context/SafraContext';
import { PeriodToggle } from '../components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '../components/PeriodoAvancadoButton';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro } from '../types/simulacao';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Relatorio'>;

// Tela "Gerar relatório", equivalente a frontend/src/pages/RelatorioPage.tsx
// (docs/specs/mobile/09-relatorio-pdf.md). Diferente do painel (spec 05), não tem cache
// offline — gerar relatório sempre busca um PDF novo do servidor, então a tela nem tenta
// nada sem conexão (mesmo critério de "exige conexão" do NovoAcertoScreen).
export function RelatorioScreen({ navigation, route }: Props) {
  const { safraId } = route.params;
  const conectado = useConectividade();
  const { safraAtiva } = useSafraAtiva();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('mes');
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPersonalizado(valor: PeriodoPersonalizado | null) {
    setPersonalizado(valor);
    setPeriodo(valor ? null : 'mes');
  }

  async function gerar() {
    if (!safraAtiva) return;
    setErro(null);
    setGerando(true);
    try {
      const filtro: FiltroRelatorio = personalizado
        ? { data_inicio: personalizado.dataInicio, data_fim: personalizado.dataFim }
        : { periodo: periodo ?? 'mes' };
      const nomeArquivo = `relatorio-${safraAtiva.safra.nome.trim().toLowerCase().replace(/\s+/g, '-')}.pdf`;
      await baixarECompartilharRelatorioRequest(safraId, filtro, nomeArquivo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o relatório');
    } finally {
      setGerando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Gerar relatório</Text>
        <View style={styles.botaoVoltar} />
      </View>

      {!conectado ? (
        <View style={styles.semConexao}>
          <WifiOff size={28} color={cores.stone[600]} />
          <Text style={styles.semConexaoTitulo}>É preciso estar conectado</Text>
          <Text style={styles.semConexaoTexto}>
            Gerar o relatório busca um PDF novo do servidor — não é possível gerar com dado
            salvo localmente. Conecte-se à internet e tente novamente.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
            <Text style={styles.texto}>
              Escolha o período e compartilhe um PDF com as despesas, vendas e a divisão de
              lucro entre sócios da {safraAtiva?.safra.nome} — pronto pra levar pra contadora.
            </Text>

            <View>
              <Text style={styles.label}>Período</Text>
              <View style={styles.filtroArea}>
                <PeriodToggle valor={periodo} onSelecionar={selecionarPeriodo} incluirSafra={false} />
                <PeriodoAvancadoButton
                  periodo={periodo}
                  personalizado={personalizado}
                  onSelecionarPeriodo={selecionarPeriodo}
                  onAplicarPersonalizado={selecionarPersonalizado}
                />
              </View>
            </View>

            {erro && <Text style={styles.erro}>{erro}</Text>}
          </ScrollView>

          <View style={styles.rodape}>
            <Pressable
              style={[styles.botaoPrimario, gerando && styles.botaoDesabilitado]}
              onPress={gerar}
              disabled={gerando}
            >
              {gerando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.linhaBotao}>
                  <FileDown size={18} color="#FFFFFF" strokeWidth={2.3} />
                  <Text style={styles.textoBotaoPrimario}>Baixar / Compartilhar PDF</Text>
                </View>
              )}
            </Pressable>
          </View>
        </>
      )}
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
  texto: {
    fontSize: 13,
    lineHeight: 19,
    color: cores.stone[600],
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.green[700],
    marginBottom: espacamento.sm,
  },
  filtroArea: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  erro: {
    color: cores.red.padrao,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
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
  linhaBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm,
  },
  textoBotaoPrimario: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
