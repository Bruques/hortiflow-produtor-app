import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, espacamento, raio } from '../theme';

export interface BottomSheetProps {
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}

// Esqueleto de folha (fundo escurecido + alça + cantos arredondados) extraído de
// CalendarSheet.tsx pra ser reaproveitado por qualquer filtro que abra uma folha — mesmo papel
// do `DropdownSheet` do web (decisão de 2026-08-04, ver docs/design/notas-de-design.md).
export function BottomSheet({ aberto, onFechar, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={aberto} transparent animationType="slide" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + espacamento.lg }]}>
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
  alca: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: raio.pill,
    backgroundColor: cores.linha,
    marginBottom: espacamento.md,
  },
});
