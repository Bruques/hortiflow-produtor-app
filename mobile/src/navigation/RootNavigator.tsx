import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { EntrarSociedadeScreen } from '../screens/EntrarSociedadeScreen';
import { SafraScreen } from '../screens/SafraScreen';
import { SafrasScreen } from '../screens/SafrasScreen';
import { NovaSafraScreen } from '../screens/NovaSafraScreen';
import { SociosScreen } from '../screens/SociosScreen';
import { TrocaSenhaScreen } from '../screens/TrocaSenhaScreen';
import { DespesasScreen } from '../screens/DespesasScreen';
import { NovaDespesaScreen } from '../screens/NovaDespesaScreen';
import { PainelScreen } from '../screens/PainelScreen';
import { AcertosScreen } from '../screens/AcertosScreen';
import { NovoAcertoScreen } from '../screens/NovoAcertoScreen';
import { AcertoDetalheScreen } from '../screens/AcertoDetalheScreen';
import { useAuth } from '../context/AuthContext';
import type { DespesaLocal } from '../types/despesa';

export type RootStackParamList = {
  Login: undefined;
  Inicio: undefined;
  EntrarSociedade: undefined;
  Safra: undefined;
  Safras: undefined;
  NovaSafra: undefined;
  Socios: { sociedadeId: string };
  TrocaSenha: undefined;
  Despesas: { safraId: string; sociedadeId: string };
  NovaDespesa: { safraId: string; sociedadeId: string; despesa?: DespesaLocal };
  Painel: { safraId: string; sociedadeId: string };
  Acertos: { safraId: string };
  NovoAcerto: { safraId: string };
  AcertoDetalhe: { acertoId: string; safraId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// A decisão entre stack logado/deslogado vem inteiramente do AuthContext (bootstrap de
// sessão completo — docs/specs/mobile/01-auth.md). Logado, a tela inicial é "Início"
// (docs/specs/mobile/03-safra.md), centrada em Safra — mesmo modelo da HomePage do web.
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
    <NavigationContainer>
      <Stack.Navigator initialRouteName={logado ? 'Inicio' : 'Login'} screenOptions={{ headerShown: false }}>
        {logado ? (
          <>
            <Stack.Screen name="Inicio" component={InicioScreen} />
            <Stack.Screen name="EntrarSociedade" component={EntrarSociedadeScreen} />
            <Stack.Screen name="Safra" component={SafraScreen} />
            <Stack.Screen name="Safras" component={SafrasScreen} />
            <Stack.Screen name="NovaSafra" component={NovaSafraScreen} />
            <Stack.Screen name="Socios" component={SociosScreen} />
            <Stack.Screen name="TrocaSenha" component={TrocaSenhaScreen} />
            <Stack.Screen name="Despesas" component={DespesasScreen} />
            <Stack.Screen name="NovaDespesa" component={NovaDespesaScreen} />
            <Stack.Screen name="Painel" component={PainelScreen} />
            <Stack.Screen name="Acertos" component={AcertosScreen} />
            <Stack.Screen name="NovoAcerto" component={NovoAcertoScreen} />
            <Stack.Screen name="AcertoDetalhe" component={AcertoDetalheScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
