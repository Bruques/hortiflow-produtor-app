import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PiggyBank, FileText, FileDown, Users, Repeat, Package, Lock, Sprout, LogOut, CreditCard, BarChart3, type LucideIcon } from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafraAtiva } from '../context/SafraContext';
import { useAuth } from '../context/AuthContext';
import { listarSociosRequest } from '../services/sociedades';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { SafraTabParamList } from '../navigation/SafraTabs';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SafraTabParamList, 'Menu'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface ItemMenu {
  chave: string;
  titulo: string;
  subtitulo: string;
  Icone: LucideIcon;
  bg: string;
  cor: string;
  aoTocar?: () => void;
}

// Grade de navegação (aba "Menu" da casca), equivalente a frontend/src/pages/MenuPage.tsx —
// mesma checagem de papel pro card "Unidades de Venda" (FINANCIADOR/MISTO, mesma regra da
// spec `06`) e mesmo botão de Sair (docs/specs/mobile/08-navegacao-resumo-e-menu.md). O card
// "Despesas pessoais" aparece desabilitado (spec `07` adiada pra pós-MVP, ver docs/backlog.md)
// — a própria spec 08 prevê esse caso: card sem link funcional até a tela existir, não é
// bloqueio pra esta spec.
export function MenuScreen({ navigation }: Props) {
  const { safraAtiva } = useSafraAtiva();
  const { usuario, sair } = useAuth();
  const [souFinanciador, setSouFinanciador] = useState(false);

  useEffect(() => {
    if (!safraAtiva || !usuario) return;
    listarSociosRequest(safraAtiva.sociedadeId)
      .then((res) => {
        const eu = res.socios.find((s) => s.usuario_id === usuario.id);
        setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
      })
      .catch(() => {});
  }, [safraAtiva, usuario]);

  if (!safraAtiva) return null;
  const { safraId, sociedadeId } = safraAtiva;

  const itens: ItemMenu[] = [
    {
      chave: 'despesas-pessoais',
      titulo: 'Despesas pessoais',
      subtitulo: 'Em breve neste app',
      Icone: PiggyBank,
      bg: cores.blue.fundo,
      cor: cores.blue.padrao,
    },
    {
      chave: 'acertos',
      titulo: 'Acertos',
      subtitulo: 'Histórico entre sócios',
      Icone: FileText,
      bg: cores.amber.fundo,
      cor: cores.amber.padrao,
      aoTocar: () => navigation.navigate('Acertos', { safraId }),
    },
    {
      chave: 'socios',
      titulo: 'Sócios e Sociedade',
      subtitulo: 'Percentual de lucro, convite',
      Icone: Users,
      bg: cores.green[100],
      cor: cores.green[800],
      aoTocar: () => navigation.navigate('Socios', { sociedadeId }),
    },
    {
      chave: 'regras',
      titulo: 'Regras de Despesa',
      subtitulo: 'Despesas automáticas',
      Icone: Repeat,
      bg: cores.green[100],
      cor: cores.green[800],
      aoTocar: () => navigation.navigate('RegrasDespesa', { sociedadeId, safraId }),
    },
    {
      chave: 'relatorio-completo',
      titulo: 'Relatório completo',
      subtitulo: 'Receita, despesas e mais',
      Icone: BarChart3,
      bg: cores.blue.fundo,
      cor: cores.blue.padrao,
      aoTocar: () => navigation.navigate('RelatorioCompleto', { safraId }),
    },
    ...(souFinanciador
      ? [
          {
            chave: 'unidades',
            titulo: 'Unidades de Venda',
            subtitulo: 'Caixa, Kg…',
            Icone: Package,
            bg: cores.green[100],
            cor: cores.green[800],
            aoTocar: () => navigation.navigate('UnidadesVenda', { sociedadeId }),
          } satisfies ItemMenu,
          {
            chave: 'relatorio',
            titulo: 'Gerar relatório',
            subtitulo: 'PDF pra contadora',
            Icone: FileDown,
            bg: cores.blue.fundo,
            cor: cores.blue.padrao,
            aoTocar: () => navigation.navigate('Relatorio', { safraId }),
          } satisfies ItemMenu,
          // Só quem paga a assinatura (o financiador titular) precisa disso — o meeiro
          // nunca vê, já que a assinatura dele nunca é checada (spec 18).
          {
            chave: 'assinatura',
            titulo: 'Minha assinatura',
            subtitulo: 'Plano, vencimento e cancelamento',
            Icone: CreditCard,
            bg: cores.green[100],
            cor: cores.green[800],
            aoTocar: () => navigation.navigate('MinhaAssinatura'),
          } satisfies ItemMenu,
        ]
      : []),
    {
      chave: 'conta',
      titulo: 'Conta e Senha',
      subtitulo: 'Trocar senha',
      Icone: Lock,
      bg: cores.green[100],
      cor: cores.green[800],
      aoTocar: () => navigation.navigate('TrocaSenha'),
    },
    {
      chave: 'nova-safra',
      titulo: 'Abrir nova safra',
      subtitulo: 'Nova temporada',
      Icone: Sprout,
      bg: cores.amber.fundo,
      cor: cores.amber.padrao,
      aoTocar: () => navigation.navigate('Safras'),
    },
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Menu</Text>

      <View style={styles.grade}>
        {itens.map((item) => (
          <Pressable
            key={item.chave}
            style={[styles.card, !item.aoTocar && styles.cardDesabilitado]}
            onPress={item.aoTocar}
            disabled={!item.aoTocar}
          >
            <View style={[styles.iconeArea, { backgroundColor: item.bg }]}>
              <item.Icone size={18} color={item.cor} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitulo}>{item.titulo}</Text>
            <Text style={styles.cardSubtitulo}>{item.subtitulo}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.botaoSair} onPress={() => sair()}>
        <LogOut size={18} color={cores.red.padrao} />
        <Text style={styles.botaoSairTexto}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    paddingHorizontal: espacamento.xl,
    paddingTop: espacamento.md,
    paddingBottom: espacamento.xl,
    gap: espacamento.lg,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: cores.stone[900],
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacamento.md - 2,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: espacamento.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: '#FFFFFF',
    borderRadius: raio.lg,
    padding: espacamento.md + 2,
  },
  cardDesabilitado: {
    opacity: 0.5,
  },
  iconeArea: {
    width: 36,
    height: 36,
    borderRadius: raio.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: cores.stone[900],
  },
  cardSubtitulo: {
    fontSize: 11,
    color: cores.stone[400],
    marginTop: -4,
  },
  botaoSair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.red.padrao,
    borderRadius: raio.lg,
    paddingVertical: espacamento.md,
    marginTop: espacamento.sm,
  },
  botaoSairTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: cores.red.padrao,
  },
});
