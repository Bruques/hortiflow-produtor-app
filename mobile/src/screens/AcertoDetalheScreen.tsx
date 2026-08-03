import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { buscarAcertoRequest } from '../services/acertos';
import { obterAcertoDetalheCache, salvarAcertoDetalheCache } from '../lib/acertosCache';
import { useConectividade } from '../lib/useConectividade';
import { formatarData, formatarHora } from '../lib/data';
import { formatarMoeda, iniciais } from '../lib/formatacao';
import { cores, espacamento, raio } from '../theme';
import type { AcertoDetalhado } from '../types/acerto';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AcertoDetalhe'>;

// Extrato de um Acerto, equivalente à frontend/src/pages/AcertoDetalhePage.tsx do web — um
// snapshot congelado (docs/specs/mobile/05-painel-e-acerto.md), por isso cachear localmente é
// seguro: diferente do painel, esse dado nunca muda depois de criado.
export function AcertoDetalheScreen({ navigation, route }: Props) {
  const { acertoId } = route.params;
  const conectado = useConectividade();

  const [acerto, setAcerto] = useState<AcertoDetalhado | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const cache = await obterAcertoDetalheCache(acertoId);
    if (cache) {
      setAcerto(cache.acerto);
      setAtualizadoEm(cache.atualizadoEm);
      setCarregando(false);
    }

    try {
      const atualizado = await buscarAcertoRequest(acertoId);
      const novoAtualizadoEm = await salvarAcertoDetalheCache(atualizado);
      setAcerto(atualizado);
      setAtualizadoEm(novoAtualizadoEm);
      setErro(null);
    } catch {
      if (!cache) setErro('Não foi possível carregar o acerto');
    } finally {
      setCarregando(false);
    }
  }, [acertoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.cabecalho}>
        <Pressable style={styles.botaoVoltar} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={18} color={cores.stone[900]} />
        </Pressable>
        <Text style={styles.tituloCabecalho}>Extrato do acerto</Text>
        <View style={styles.botaoVoltar} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        {erro && <Text style={styles.erro}>{erro}</Text>}
        {!conectado && atualizadoEm && (
          <Text style={styles.avisoOffline}>Atualizado às {formatarHora(atualizadoEm)} — sem conexão</Text>
        )}
        {carregando && !acerto && <ActivityIndicator style={{ marginTop: espacamento.lg }} />}

        {acerto && (
          <>
            <View style={styles.cartao}>
              <Text style={[styles.badgeTipo, acerto.tipo === 'FINAL' ? styles.badgeFinal : styles.badgeParcial]}>
                {acerto.tipo === 'FINAL' ? 'Final' : 'Parcial'}
              </Text>
              <Text style={styles.cartaoPeriodo}>
                {formatarData(acerto.data_inicio)} – {formatarData(acerto.data_fim)}
              </Text>
              <Text style={styles.cartaoRegistradoEm}>Registrado em {formatarData(acerto.criado_em)}</Text>
              <Text style={styles.cartaoLabel}>Lucro líquido dividido no período</Text>
              <Text style={[styles.cartaoValor, acerto.lucroLiquido < 0 && { color: '#ffb4b4' }]}>
                {formatarMoeda(acerto.lucroLiquido)}
              </Text>
              <View style={styles.cartaoLinha}>
                <Text style={styles.cartaoDetalhe}>Receita: {formatarMoeda(acerto.receita)}</Text>
                <Text style={styles.cartaoDetalhe}>Despesas: {formatarMoeda(acerto.despesas)}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.tituloSecao}>Divisão por sócio</Text>
              {acerto.socios.map((s) => (
                <View key={s.socio_id} style={styles.linhaSocio}>
                  <View style={styles.linhaSocioTopo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTexto}>{iniciais(s.nome)}</Text>
                    </View>
                    <Text style={styles.linhaSocioNome}>{s.nome}</Text>
                    <View style={styles.linhaSocioValorArea}>
                      <Text style={[styles.linhaSocioValor, s.valor_lucro < 0 && { color: cores.red.padrao }]}>
                        {formatarMoeda(s.valor_lucro)}
                      </Text>
                      <Text style={styles.linhaSocioValorLabel}>Recebido</Text>
                    </View>
                  </View>
                  <View style={styles.linhaSocioRodape}>
                    <View>
                      <Text style={styles.linhaSocioRodapeLabel}>Despesas bancadas</Text>
                      <Text style={styles.linhaSocioRodapeValor}>{formatarMoeda(s.despesas_bancadas)}</Text>
                    </View>
                    <View>
                      <Text style={styles.linhaSocioRodapeLabel}>Percentual aplicado</Text>
                      <Text style={styles.linhaSocioRodapeValor}>{s.percentual_aplicado}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.info}>
              <ShieldCheck size={17} color={cores.stone[600]} />
              <Text style={styles.infoTexto}>
                Esse extrato é um retrato congelado desse período. Se alguma despesa ou venda for editada
                depois, esses valores não mudam — pra alterar, seria preciso um novo acerto.
              </Text>
            </View>
          </>
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
  avisoOffline: {
    fontSize: 11.5,
    color: cores.amber.padrao,
    backgroundColor: cores.amber.fundo,
    borderRadius: raio.md,
    padding: espacamento.sm + 2,
    textAlign: 'center',
  },
  cartao: {
    backgroundColor: cores.green[900],
    borderRadius: 18,
    padding: espacamento.lg + 4,
  },
  badgeTipo: {
    alignSelf: 'flex-start',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm + 2,
    paddingVertical: 2,
  },
  badgeFinal: {
    backgroundColor: '#FFFFFF',
    color: cores.green[800],
  },
  badgeParcial: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#FFFFFF',
  },
  cartaoPeriodo: {
    marginTop: espacamento.sm + 2,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cartaoRegistradoEm: {
    marginTop: 2,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.8)',
  },
  cartaoLabel: {
    marginTop: espacamento.md,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  cartaoValor: {
    marginTop: 2,
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cartaoLinha: {
    flexDirection: 'row',
    gap: espacamento.lg,
    marginTop: espacamento.sm,
  },
  cartaoDetalhe: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
  },
  tituloSecao: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
    marginBottom: espacamento.sm,
  },
  linhaSocio: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
    marginBottom: espacamento.sm + 2,
    gap: espacamento.sm + 2,
  },
  linhaSocioTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: raio.pill,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: cores.green[800],
  },
  linhaSocioNome: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  linhaSocioValorArea: {
    alignItems: 'flex-end',
  },
  linhaSocioValor: {
    fontSize: 16,
    fontWeight: '800',
    color: cores.green[800],
  },
  linhaSocioValorLabel: {
    fontSize: 10,
    color: cores.stone[400],
  },
  linhaSocioRodape: {
    flexDirection: 'row',
    gap: espacamento.xl,
    borderTopWidth: 1,
    borderTopColor: cores.cream[100],
    borderStyle: 'dashed',
    paddingTop: espacamento.sm + 2,
  },
  linhaSocioRodapeLabel: {
    fontSize: 10.5,
    color: cores.stone[400],
  },
  linhaSocioRodapeValor: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
    marginTop: 1,
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
});
