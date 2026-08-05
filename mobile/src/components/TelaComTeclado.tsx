import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

interface TelaComTecladoProps {
  children: ReactNode;
}

// Evita que o teclado do iOS cubra input/botão nas telas de formulário: desloca o conteúdo
// pra cima quando o teclado abre. Fechar o teclado ao interagir com a tela é responsabilidade do
// ScrollView de cada tela (keyboardDismissMode="on-drag") — um TouchableWithoutFeedback aqui por
// fora do ScrollView disputava o gesto de toque com ele e deixava o scroll instável (só
// "destravava" quando o teclado abria e forçava um recálculo de layout).
export function TelaComTeclado({ children }: TelaComTecladoProps) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}
