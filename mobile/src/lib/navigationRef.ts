import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';

// Permite navegar de fora de um componente de tela (ex: o interceptor de resposta do
// apiClient em AuthContext.tsx, que precisa levar pra AssinaturaBloqueio num 402 sem ter
// acesso a nenhum `navigation` de tela). Import só de tipo de RootNavigator — sem ciclo em
// tempo de execução, o tipo é apagado na compilação.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
