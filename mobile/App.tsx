import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { SociedadeProvider } from './src/context/SociedadeContext';
import { iniciarSincronizacaoAutomatica } from './src/lib/syncTrigger';

export default function App() {
  useEffect(() => {
    const cancelar = iniciarSincronizacaoAutomatica();
    return cancelar;
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SociedadeProvider>
          <RootNavigator />
        </SociedadeProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
