import type { ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, View } from 'react-native';

interface TelaComTecladoProps {
  children: ReactNode;
}

// Evita que o teclado do iOS cubra input/botão nas telas de formulário: desloca o conteúdo
// pra cima quando o teclado abre (KeyboardAvoidingView) e fecha o teclado ao tocar fora de um
// campo (TouchableWithoutFeedback). Envolve cabeçalho + scroll + rodapé de cada tela, logo
// dentro do SafeAreaView.
export function TelaComTeclado({ children }: TelaComTecladoProps) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>{children}</View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
