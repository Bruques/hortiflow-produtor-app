import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espacamento, raio } from '../theme';

export interface BottomSheetProps {
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  // Por padrão a folha "abraça" o conteúdo (até um teto de 82%, pra nunca estourar a tela) —
  // é o que serve o CalendarSheet e o filtro de período, ambos com conteúdo curto. O formulário
  // de regra de despesa recorrente é o único caso que precisa de altura sempre fixa: ele muda de
  // tamanho (rateio personalizado aparece/some) e, com altura livre, o rodapé (Cancelar/Criar
  // regra) ficava colado no último item em vez de fixo no rodapé da folha.
  alturaFixa?: boolean;
}

// Esqueleto de folha (fundo escurecido + alça + cantos arredondados) extraído de
// CalendarSheet.tsx pra ser reaproveitado por qualquer filtro que abra uma folha — mesmo papel
// do `DropdownSheet` do web (decisão de 2026-08-04, ver docs/design/notas-de-design.md).
// KeyboardAvoidingView não mede a distância até o teclado corretamente dentro de <Modal> (bug
// conhecido do RN — sobrava um vão em branco entre o rodapé e o teclado), então a altura do
// teclado é acompanhada manualmente. A folha em si NÃO se desloca (bottom fica sempre 0) — só o
// paddingBottom cresce pra "comer" o espaço do teclado, encolhendo a área de conteúdo. Deslocar a
// folha inteira (bottom: alturaTeclado) fazia esse ajuste competir com o auto-scroll nativo do
// ScrollView pro campo focado, produzindo um pulo que só se corrigia rolando manualmente.
export function BottomSheet({ aberto, onFechar, children, alturaFixa = false }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [alturaTeclado, setAlturaTeclado] = useState(0);

  useEffect(() => {
    const eventoMostrar = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventoEsconder = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const mostrar = Keyboard.addListener(eventoMostrar, (e) => setAlturaTeclado(e.endCoordinates.height));
    const esconder = Keyboard.addListener(eventoEsconder, () => setAlturaTeclado(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  return (
    <Modal visible={aberto} transparent animationType="slide" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar} />
      <View
        style={[
          styles.sheet,
          alturaFixa ? styles.sheetAlturaFixa : styles.sheetAlturaLivre,
          {
            paddingBottom: alturaTeclado > 0 ? alturaTeclado + espacamento.lg : insets.bottom + espacamento.lg,
          },
        ]}
      >
        <View style={styles.alca} />
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: espacamento.lg + 4,
    paddingTop: espacamento.sm + 2,
  },
  sheetAlturaFixa: {
    height: '82%',
  },
  sheetAlturaLivre: {
    maxHeight: '82%',
  },
  alca: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: raio.pill,
    backgroundColor: cores.linha,
    marginBottom: espacamento.md,
  },
});
