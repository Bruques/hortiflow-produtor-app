import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SociedadesScreen } from '../screens/SociedadesScreen';
import { CriarSociedadeScreen } from '../screens/CriarSociedadeScreen';
import { EntrarSociedadeScreen } from '../screens/EntrarSociedadeScreen';
import { SociosScreen } from '../screens/SociosScreen';
import { TrocaSenhaScreen } from '../screens/TrocaSenhaScreen';
import { useAuth } from '../context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  Sociedades: undefined;
  CriarSociedade: undefined;
  EntrarSociedade: undefined;
  Socios: undefined;
  TrocaSenha: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// A decisão entre stack logado/deslogado vem inteiramente do AuthContext (bootstrap de
// sessão completo: token + validação em background contra /auth/me — docs/specs/mobile/01-auth.md).
// Logado, a tela inicial é "Minhas sociedades" (docs/specs/mobile/02-sociedade-e-socios.md) —
// não existe mais a Home placeholder das specs 00/01.
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
      <Stack.Navigator initialRouteName={logado ? 'Sociedades' : 'Login'} screenOptions={{ headerShown: false }}>
        {logado ? (
          <>
            <Stack.Screen name="Sociedades" component={SociedadesScreen} />
            <Stack.Screen name="CriarSociedade" component={CriarSociedadeScreen} />
            <Stack.Screen name="EntrarSociedade" component={EntrarSociedadeScreen} />
            <Stack.Screen name="Socios" component={SociosScreen} />
            <Stack.Screen name="TrocaSenha" component={TrocaSenhaScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
