import { useEffect } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { SafraProvider } from './src/context/SafraContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { initSentry } from './src/lib/sentry';
import { iniciarSincronizacaoAutomatica } from './src/lib/syncTrigger';
import { sincronizarTudo } from './src/lib/syncQueue';
import { registrarProcessadoresDespesas } from './src/lib/despesasQueue';
import { registrarProcessadoresVendas } from './src/lib/vendasQueue';
import { registrarProcessadoresSugestoes } from './src/lib/sugestaoQueue';

// Fora do componente, de propósito: precisa rodar uma única vez, o mais cedo possível no
// bootstrap do app (antes do primeiro render), pra capturar erro mesmo em telas iniciais.
initSentry();

export default function App() {
  useEffect(() => {
    registrarProcessadoresDespesas();
    registrarProcessadoresVendas();
    registrarProcessadoresSugestoes();
    const cancelar = iniciarSincronizacaoAutomatica();

    // Reforço além da transição offline→online do NetInfo (syncTrigger.ts): uma falha
    // transitória (timeout, backend instável) enquanto o NetInfo nunca chegou a marcar o
    // aparelho como "desconectado" deixava o item preso em "erro" pra sempre, sem nada tentar
    // de novo — bug relatado 2026-08-12 (venda presa em erro mesmo com internet). Reabrir o
    // app é um sinal barato e confiável de "provavelmente há conexão agora", então toda vez
    // que o app volta ao primeiro plano a fila tenta de novo (inofensivo se ainda offline: a
    // tentativa só falha e mantém o item como está).
    const assinaturaAppState = AppState.addEventListener('change', (proximoEstado) => {
      if (proximoEstado === 'active') {
        sincronizarTudo();
      }
    });

    return () => {
      cancelar();
      assinaturaAppState.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <SafraProvider>
            <RootNavigator />
          </SafraProvider>
        </AuthProvider>
      </ErrorBoundary>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
