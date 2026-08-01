import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { iniciarSincronizacaoAutomatica } from './src/lib/syncTrigger';

export default function App() {
  useEffect(() => {
    const cancelar = iniciarSincronizacaoAutomatica();
    return cancelar;
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
