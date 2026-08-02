import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TrocaSenhaScreen } from '../screens/TrocaSenhaScreen';
import { useAuth } from '../context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  TrocaSenha: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// A decisão entre stack logado/deslogado vem inteiramente do AuthContext (bootstrap de
// sessão completo: token + validação em background contra /auth/me — docs/specs/mobile/01-auth.md).
// Trocar de stack ao logar/deslogar é automático: mudar `logado` aqui já troca as telas
// disponíveis, sem precisar de navigation.replace nas telas.
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
      <Stack.Navigator initialRouteName={logado ? 'Home' : 'Login'} screenOptions={{ headerShown: false }}>
        {logado ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="TrocaSenha" component={TrocaSenhaScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
