import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, LogOut } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { escolherPlanoRequest, listarPlanosRequest, type PlanoCatalogo } from '../services/assinatura';
import { mensagemErro } from '../lib/erroApi';
import { formatarMoeda } from '../lib/formatacao';
import { useAuth } from '../context/AuthContext';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingPlano'>;

// Spec 25 — tela de plano (Fluxo A): plano recomendado vem expandido por padrão, os outros
// dois colapsados (nome + preço), expansíveis ao toque. Ciclo anual começa pré-selecionado
// e nunca mostra o total como número principal — só o valor mensal equivalente em destaque.
export function OnboardingPlanoScreen({ route, navigation }: Props) {
  const { planoRecomendadoId } = route.params;
  const { sair } = useAuth();

  const [planos, setPlanos] = useState<PlanoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [expandidoId, setExpandidoId] = useState<string | null>(planoRecomendadoId);
  const [selecionadoId, setSelecionadoId] = useState(planoRecomendadoId);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    listarPlanosRequest()
      .then(setPlanos)
      .catch(() => setErro('Não foi possível carregar os planos'))
      .finally(() => setCarregando(false));
  }, []);

  function alternarExpandido(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id));
    setSelecionadoId(id);
  }

  async function confirmar() {
    setConfirmando(true);
    setErro(null);
    try {
      await escolherPlanoRequest(selecionadoId, ciclo);
      navigation.replace('Inicio');
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível confirmar o plano'));
      setConfirmando(false);
    }
  }

  const planoSelecionado = planos.find((p) => p.id === selecionadoId);

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
        <View>
          <Text style={styles.titulo}>Plano recomendado pra você</Text>
          <Text style={styles.subtitulo}>Você pode trocar de plano quando quiser.</Text>
        </View>

        <View style={styles.toggle}>
          <Pressable style={[styles.toggleOpcao, ciclo === 'MENSAL' && styles.toggleOpcaoAtiva]} onPress={() => setCiclo('MENSAL')}>
            <Text style={[styles.toggleTexto, ciclo === 'MENSAL' && styles.toggleTextoAtivo]}>Mensal</Text>
          </Pressable>
          <Pressable style={[styles.toggleOpcao, ciclo === 'ANUAL' && styles.toggleOpcaoAtiva]} onPress={() => setCiclo('ANUAL')}>
            <Text style={[styles.toggleTexto, ciclo === 'ANUAL' && styles.toggleTextoAtivo]}>Anual — 20% de desconto</Text>
          </Pressable>
        </View>

        {carregando && <ActivityIndicator />}

        <View style={styles.lista}>
          {planos.map((plano) => {
            const expandido = expandidoId === plano.id;
            const recomendado = plano.id === planoRecomendadoId;
            const selecionado = selecionadoId === plano.id;
            return (
              <Pressable
                key={plano.id}
                // O destaque verde segue a SELEÇÃO, não a recomendação — antes o cartão
                // recomendado ficava sempre verde mesmo quando o usuário selecionava outro
                // plano, dando a impressão de que o recomendado continuava escolhido
                // (bug relatado pelo dev, 2026-09-15). "Recomendado" agora é só o selo.
                style={[styles.cartao, selecionado && styles.cartaoSelecionado]}
                onPress={() => alternarExpandido(plano.id)}
              >
                {recomendado && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTexto}>Recomendado</Text>
                  </View>
                )}

                <View style={styles.cartaoCabecalho}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartaoNome}>{plano.nome}</Text>
                    {ciclo === 'MENSAL' ? (
                      <Text style={styles.cartaoValor}>{formatarMoeda(plano.valorMensal)}/mês</Text>
                    ) : (
                      <>
                        <Text style={styles.cartaoValor}>{formatarMoeda(plano.valorAnualExibidoPorMes)}/mês</Text>
                        <Text style={styles.cartaoValorTotal}>{formatarMoeda(plano.valorAnualTotal)}/ano</Text>
                      </>
                    )}
                  </View>
                  {selecionadoId === plano.id && (
                    <View style={styles.checkSelecionado}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                {expandido && (
                  <View style={styles.recursos}>
                    <LinhaRecurso rotulo="Safras ativas" valor={plano.limiteSafrasAtivas === null ? 'Ilimitado' : `Até ${plano.limiteSafrasAtivas}`} />
                    <LinhaRecurso rotulo="Importação por IA" valor={`Até ${plano.limiteImportacaoIAMes}/mês`} />
                    <LinhaRecurso rotulo="Despesas pessoais" valor={plano.despesasPessoais ? 'Incluso' : 'Não incluso'} />
                    <LinhaRecurso rotulo="Suporte prioritário" valor={plano.suportePrioritario ? 'Incluso' : 'Não incluso'} />
                    <LinhaRecurso
                      rotulo="Implantação assistida"
                      valor={ciclo === 'ANUAL' || plano.implantacaoAssistidaMensal ? 'Incluso' : 'Não incluso'}
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <Pressable style={[styles.botaoPrimario, confirmando && styles.botaoDesabilitado]} onPress={confirmar} disabled={confirmando}>
          {confirmando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoPrimario}>Continuar com {planoSelecionado?.nome ?? '...'}</Text>
          )}
        </Pressable>

        {/* Mesmo gap já resolvido em AssinaturaBloqueioScreen e OnboardingFormularioScreen
            (dev relatou, 2026-09-18): sem isso, quem cai aqui fica preso sem jeito de sair. */}
        <Pressable style={styles.botaoSair} onPress={() => sair()}>
          <LogOut size={18} color={cores.red.padrao} />
          <Text style={styles.textoBotaoSair}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinhaRecurso({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.linhaRecurso}>
      <Text style={styles.linhaRecursoRotulo}>{rotulo}</Text>
      <Text style={styles.linhaRecursoValor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.cream[50],
  },
  conteudo: {
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
    textAlign: 'center',
    color: cores.stone[600],
    marginTop: 2,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: cores.cream[100],
    borderRadius: raio.md + 2,
    padding: 4,
    gap: 4,
  },
  toggleOpcao: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: espacamento.sm + 1,
    borderRadius: raio.md,
  },
  toggleOpcaoAtiva: {
    backgroundColor: '#FFFFFF',
  },
  toggleTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[600],
  },
  toggleTextoAtivo: {
    color: cores.green[800],
  },
  lista: {
    gap: espacamento.sm + 2,
  },
  cartao: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    padding: espacamento.lg,
    backgroundColor: '#FFFFFF',
  },
  cartaoSelecionado: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: cores.amber.padrao,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.sm,
    paddingVertical: 3,
    marginBottom: espacamento.sm,
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cartaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacamento.sm,
  },
  cartaoNome: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
  },
  cartaoValor: {
    fontSize: 17,
    fontWeight: '800',
    color: cores.green[800],
    marginTop: 2,
  },
  cartaoValorTotal: {
    fontSize: 11.5,
    color: cores.stone[600],
    marginTop: 1,
  },
  checkSelecionado: {
    width: 22,
    height: 22,
    borderRadius: raio.pill,
    backgroundColor: cores.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  recursos: {
    marginTop: espacamento.md,
    paddingTop: espacamento.md,
    borderTopWidth: 1,
    borderTopColor: cores.linha,
    gap: espacamento.xs + 4,
  },
  linhaRecurso: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linhaRecursoRotulo: {
    fontSize: 12.5,
    color: cores.stone[600],
  },
  linhaRecursoValor: {
    fontSize: 12.5,
    fontWeight: '700',
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
