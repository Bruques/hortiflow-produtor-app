import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BannerSemConexao } from '../components/BannerSemConexao';
import { Topbar } from '../components/Topbar';
import { BottomNavTabs } from '../components/BottomNavTabs';
import { ResumoScreen } from '../screens/ResumoScreen';
import { VendasScreen } from '../screens/VendasScreen';
import { DespesasScreen } from '../screens/DespesasScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { cores } from '../theme';
import type { RootStackParamList } from './RootNavigator';

export type SafraTabParamList = {
  Resumo: undefined;
  Vendas: undefined;
  Despesas: undefined;
  Menu: undefined;
};

const Tab = createBottomTabNavigator<SafraTabParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'Safra'>;

// Casca de navegação (docs/specs/mobile/08-navegacao-resumo-e-menu.md): Topbar fixa + um
// @react-navigation/bottom-tabs de verdade com as 4 abas (Resumo, Vendas, Despesas, Menu), tab
// bar customizada com FAB. Trocado de uma tentativa anterior baseada só num stack plano (ver
// decisão registrada na spec) porque ali cada "aba" era uma tela empilhada: a troca de aba
// deslizava como navegação de página e respondia ao gesto de arrastar da borda pra voltar —
// os dois problemas relatados ao testar. Um tab navigator resolve os dois de graça: troca
// instantânea, sem push, sem gesto de swipe-back.
//
// Registrada como a rota raiz "Resumo" do stack principal (RootNavigator) — telas de
// formulário em tela cheia (NovaVenda, NovaDespesa etc.) e páginas de detalhe alcançadas pelo
// Menu (Acertos, Sócios, Regras...) continuam fora deste navigator, como pushes normais do
// stack raiz, com sua própria animação e gesto de voltar (que ali faz sentido).
export function SafraTabsScreen({ navigation }: Props) {
  return (
    <View style={styles.raiz}>
      <SafeAreaView style={styles.topo} edges={['top']}>
        <BannerSemConexao />
        <Topbar />
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <BottomNavTabs {...props} navegacaoRaiz={navigation} />}
        >
          <Tab.Screen name="Resumo" component={ResumoScreen} />
          <Tab.Screen name="Vendas" component={VendasScreen} />
          <Tab.Screen name="Despesas" component={DespesasScreen} />
          <Tab.Screen name="Menu" component={MenuScreen} />
        </Tab.Navigator>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: cores.cream[50],
  },
  topo: {
    flex: 1,
  },
});
