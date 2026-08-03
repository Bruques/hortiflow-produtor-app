import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { SafraProvider } from './src/context/SafraContext';
import { iniciarSincronizacaoAutomatica } from './src/lib/syncTrigger';
import { registrarProcessadoresDespesas } from './src/lib/despesasQueue';
import { registrarProcessadoresVendas } from './src/lib/vendasQueue';
import { registrarProcessadoresSugestoes } from './src/lib/sugestaoQueue';

export default function App() {
  useEffect(() => {
    registrarProcessadoresDespesas();
    registrarProcessadoresVendas();
    registrarProcessadoresSugestoes();
    const cancelar = iniciarSincronizacaoAutomatica();
    return cancelar;
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafraProvider>
          <RootNavigator />
        </SafraProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
