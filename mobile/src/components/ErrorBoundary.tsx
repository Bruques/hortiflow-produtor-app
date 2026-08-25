import { StyleSheet, Text, View } from 'react-native';
import Sentry from '../lib/sentry';
import { cores, espacamento } from '../theme';

// Envolve a navegação principal (App.tsx): um erro de renderização em qualquer tela hoje
// derrubava o app inteiro sem explicação nenhuma pro produtor (spec 17, critério 9).
// `Sentry.ErrorBoundary` já captura a exceção automaticamente antes de renderizar o fallback.
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={<TelaDeErro />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

function TelaDeErro() {
  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Algo deu errado</Text>
      <Text style={estilos.texto}>
        Feche e abra o app novamente. Se o problema continuar, entre em contato.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.cream[50],
    padding: espacamento.xl,
    gap: espacamento.sm,
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: cores.stone[900],
  },
  texto: {
    fontSize: 14,
    color: cores.stone[600],
    textAlign: 'center',
  },
});
