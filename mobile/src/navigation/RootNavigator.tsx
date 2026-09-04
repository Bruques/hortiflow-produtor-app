import { ActivityIndicator, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { cores } from '../theme';
import { LoginScreen } from '../screens/LoginScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { EntrarSociedadeScreen } from '../screens/EntrarSociedadeScreen';
import { SafraTabsScreen } from './SafraTabs';
import { SafrasScreen } from '../screens/SafrasScreen';
import { NovaSafraScreen } from '../screens/NovaSafraScreen';
import { SociosScreen } from '../screens/SociosScreen';
import { TrocaSenhaScreen } from '../screens/TrocaSenhaScreen';
import { NovaDespesaScreen } from '../screens/NovaDespesaScreen';
import { NovaVendaScreen } from '../screens/NovaVendaScreen';
import { ConfiguracoesUnidadesVendaScreen } from '../screens/ConfiguracoesUnidadesVendaScreen';
import { ConfiguracoesRegrasDespesaScreen } from '../screens/ConfiguracoesRegrasDespesaScreen';
import { AcertosScreen } from '../screens/AcertosScreen';
import { NovoAcertoScreen } from '../screens/NovoAcertoScreen';
import { AcertoDetalheScreen } from '../screens/AcertoDetalheScreen';
import { RelatorioScreen } from '../screens/RelatorioScreen';
import { RelatorioCompletoScreen } from '../screens/RelatorioCompletoScreen';
import { MinhaAssinaturaScreen } from '../screens/MinhaAssinaturaScreen';
import { AssinaturaBloqueioScreen } from '../screens/AssinaturaBloqueioScreen';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../lib/navigationRef';
import type { DespesaLocal } from '../types/despesa';
import type { VendaLocal } from '../types/venda';

export type RootStackParamList = {
  Login: undefined;
  Inicio: undefined;
  EntrarSociedade: undefined;
  // "Safra" é a rota raiz da casca de navegação: renderiza SafraTabsScreen, que por sua vez
  // hospeda o tab navigator com as 4 abas de verdade (Resumo/Vendas/Despesas/Menu — ver
  // SafraTabParamList em ./SafraTabs.tsx). Vendas/Despesas/Menu não são mais rotas deste stack.
  // Nome diferente de "Resumo" de propósito: como a aba raiz do tab navigator também se chama
  // "Resumo", usar o mesmo nome aqui causava o aviso do React Navigation "Found screens with
  // the same name nested inside one another" e navegação ambígua entre os dois navigators.
  Safra: undefined;
  Safras: undefined;
  NovaSafra: undefined;
  Socios: { safraId: string };
  TrocaSenha: undefined;
  NovaDespesa: { safraId: string; sociedadeId: string; despesa?: DespesaLocal };
  NovaVenda: { safraId: string; sociedadeId: string; venda?: VendaLocal };
  UnidadesVenda: { sociedadeId: string };
  RegrasDespesa: { sociedadeId: string; safraId: string };
  Acertos: { safraId: string };
  NovoAcerto: { safraId: string };
  AcertoDetalhe: { acertoId: string; safraId: string };
  Relatorio: { safraId: string };
  RelatorioCompleto: { safraId: string };
  MinhaAssinatura: undefined;
  // Sem parâmetros de propósito — navegada pelo interceptor do apiClient (AuthContext.tsx),
  // que não tem contexto nenhum sobre qual sociedade/safra disparou o 402.
  AssinaturaBloqueio: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sem isso, o React Navigation aplica seu DefaultTheme (fundo #f2f2f2) atrás das telas dentro
// do Tab.Navigator (SafraTabs.tsx) — diferente do cores.cream[50] da Topbar acima dele, criando
// uma faixa visível entre os dois. Sobrescreve só `colors.background` pra igualar ao resto do
// app (feedback do dev, 2026-08-04).
const temaNavegacao = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: cores.cream[50] },
};

// A decisão entre stack logado/deslogado vem inteiramente do AuthContext (bootstrap de
// sessão completo — docs/specs/mobile/01-auth.md). Logado, a tela inicial é "Início"
// (docs/specs/mobile/03-safra.md); ao entrar numa safra, o destino é a rota "Safra", que
// renderiza a casca de navegação (docs/specs/mobile/08-navegacao-resumo-e-menu.md) com suas 4
// abas (Resumo/Vendas/Despesas/Menu, ver SafraTabs.tsx); Acertos e as demais telas (formulários,
// configurações) continuam pushes simples deste stack, fora da casca.
export function RootNavigator() {
  const { logado, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={temaNavegacao}>
      <Stack.Navigator initialRouteName={logado ? 'Inicio' : 'Login'} screenOptions={{ headerShown: false }}>
        {logado ? (
          <>
            <Stack.Screen name="Inicio" component={InicioScreen} />
            <Stack.Screen name="MinhaAssinatura" component={MinhaAssinaturaScreen} />
            <Stack.Screen name="AssinaturaBloqueio" component={AssinaturaBloqueioScreen} />
            <Stack.Screen name="EntrarSociedade" component={EntrarSociedadeScreen} />
            <Stack.Screen name="Safra" component={SafraTabsScreen} />
            <Stack.Screen name="Safras" component={SafrasScreen} />
            <Stack.Screen name="NovaSafra" component={NovaSafraScreen} />
            <Stack.Screen name="Socios" component={SociosScreen} />
            <Stack.Screen name="TrocaSenha" component={TrocaSenhaScreen} />
            <Stack.Screen name="NovaDespesa" component={NovaDespesaScreen} />
            <Stack.Screen name="NovaVenda" component={NovaVendaScreen} />
            <Stack.Screen name="UnidadesVenda" component={ConfiguracoesUnidadesVendaScreen} />
            <Stack.Screen name="RegrasDespesa" component={ConfiguracoesRegrasDespesaScreen} />
            <Stack.Screen name="Acertos" component={AcertosScreen} />
            <Stack.Screen name="NovoAcerto" component={NovoAcertoScreen} />
            <Stack.Screen name="AcertoDetalhe" component={AcertoDetalheScreen} />
            <Stack.Screen name="Relatorio" component={RelatorioScreen} />
            <Stack.Screen name="RelatorioCompleto" component={RelatorioCompletoScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
