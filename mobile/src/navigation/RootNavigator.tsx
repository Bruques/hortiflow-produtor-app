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
import { DespesasPessoaisScreen } from '../screens/DespesasPessoaisScreen';
import { NovaDespesaPessoalScreen } from '../screens/NovaDespesaPessoalScreen';
import { DespesaCompartilhadaScreen } from '../screens/DespesaCompartilhadaScreen';
import { NovaVendaScreen } from '../screens/NovaVendaScreen';
import { ImportarLancamentosScreen } from '../screens/ImportarLancamentosScreen';
import { ConfiguracoesUnidadesVendaScreen } from '../screens/ConfiguracoesUnidadesVendaScreen';
import { ConfiguracoesRegrasDespesaScreen } from '../screens/ConfiguracoesRegrasDespesaScreen';
import { AcertosScreen } from '../screens/AcertosScreen';
import { NovoAcertoScreen } from '../screens/NovoAcertoScreen';
import { AcertoDetalheScreen } from '../screens/AcertoDetalheScreen';
import { RelatorioScreen } from '../screens/RelatorioScreen';
import { RelatorioCompletoScreen } from '../screens/RelatorioCompletoScreen';
import { MinhaAssinaturaScreen } from '../screens/MinhaAssinaturaScreen';
import { AssinaturaBloqueioScreen } from '../screens/AssinaturaBloqueioScreen';
import { OnboardingFormularioScreen } from '../screens/OnboardingFormularioScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { TermosAceiteScreen } from '../screens/TermosAceiteScreen';
import { TermosDocumentoScreen } from '../screens/TermosDocumentoScreen';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../lib/navigationRef';
import type { DespesaLocal, DespesaPessoalLocal } from '../types/despesa';
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
  DespesasPessoais: { safraId: string };
  NovaDespesaPessoal: { safraId: string; despesaPessoal?: DespesaPessoalLocal };
  DespesaCompartilhada: undefined;
  NovaVenda: { safraId: string; sociedadeId: string; venda?: VendaLocal };
  ImportarLancamentos: { safraId: string; sociedadeId: string };
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
  // Spec 25 — fluxo de onboarding automatizado, entre o cadastro e a Início.
  OnboardingFormulario: undefined;
  Checkout: undefined;
  // Spec 26 — sem parâmetros, mesmo motivo do AssinaturaBloqueio: navegada pelo interceptor
  // do apiClient (AuthContext.tsx) a partir de um 401 TERMOS_PENDENTES em qualquer chamada.
  TermosAceite: undefined;
  // Acessível logado (a partir de TermosAceite ou Conta e Senha) e deslogado (a partir do
  // cadastro, no LoginScreen) — por isso declarada fora do bloco condicional abaixo.
  TermosDocumento: { documento: 'uso' | 'privacidade' };
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
//
// "TermosDocumento" é acessível dos dois lados (logado e deslogado — spec 26), por isso está
// duplicada dentro de cada bloco em vez de declarada uma vez só fora do condicional: quando
// estava fora, era a primeira tela do array de children, e ao logar (a tela ativa "Login"
// desaparecer do array) o React Navigation recalculava o estado caindo nela em vez de em
// "Inicio" — travava o usuário com "Cannot read property 'documento' of undefined" logo após
// o login (bug relatado 2026-09-18). Repetir a tela dentro de cada bloco evita esse reset.
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
            <Stack.Screen name="TermosDocumento" component={TermosDocumentoScreen} />
            <Stack.Screen name="TermosAceite" component={TermosAceiteScreen} />
            <Stack.Screen name="MinhaAssinatura" component={MinhaAssinaturaScreen} />
            <Stack.Screen name="AssinaturaBloqueio" component={AssinaturaBloqueioScreen} />
            <Stack.Screen name="OnboardingFormulario" component={OnboardingFormularioScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="EntrarSociedade" component={EntrarSociedadeScreen} />
            <Stack.Screen name="Safra" component={SafraTabsScreen} />
            <Stack.Screen name="Safras" component={SafrasScreen} />
            <Stack.Screen name="NovaSafra" component={NovaSafraScreen} />
            <Stack.Screen name="Socios" component={SociosScreen} />
            <Stack.Screen name="TrocaSenha" component={TrocaSenhaScreen} />
            <Stack.Screen name="NovaDespesa" component={NovaDespesaScreen} />
            <Stack.Screen name="DespesasPessoais" component={DespesasPessoaisScreen} />
            <Stack.Screen name="NovaDespesaPessoal" component={NovaDespesaPessoalScreen} />
            <Stack.Screen name="DespesaCompartilhada" component={DespesaCompartilhadaScreen} />
            <Stack.Screen name="NovaVenda" component={NovaVendaScreen} />
            <Stack.Screen name="ImportarLancamentos" component={ImportarLancamentosScreen} />
            <Stack.Screen name="UnidadesVenda" component={ConfiguracoesUnidadesVendaScreen} />
            <Stack.Screen name="RegrasDespesa" component={ConfiguracoesRegrasDespesaScreen} />
            <Stack.Screen name="Acertos" component={AcertosScreen} />
            <Stack.Screen name="NovoAcerto" component={NovoAcertoScreen} />
            <Stack.Screen name="AcertoDetalhe" component={AcertoDetalheScreen} />
            <Stack.Screen name="Relatorio" component={RelatorioScreen} />
            <Stack.Screen name="RelatorioCompleto" component={RelatorioCompletoScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="TermosDocumento" component={TermosDocumentoScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
