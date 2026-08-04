import { Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { CalendarGrid } from './CalendarGrid';
import { cores, espacamento } from '../theme';

export interface CalendarSheetProps {
  aberto: boolean;
  valor: string; // yyyy-mm-dd ou ''
  onSelecionar: (iso: string) => void;
  onFechar: () => void;
}

// Folha com o CalendarGrid (portado de frontend/src/components/ui/calendar-sheet.tsx), em vez
// de um date picker nativo do sistema — o objetivo aqui (2026-08-03, ver docs/backlog.md) é a
// mesma experiência visual/de marca do web (toca no dia, sem digitar), não só "um calendário
// qualquer", e evita puxar uma dependência nativa nova só pra isso. Uso isolado (um Modal só) —
// pra embutir o calendário dentro de outra folha já aberta, use CalendarGrid direto (ver
// PeriodoAvancadoButton.tsx).
export function CalendarSheet({ aberto, valor, onSelecionar, onFechar }: CalendarSheetProps) {
  return (
    <BottomSheet aberto={aberto} onFechar={onFechar}>
      <CalendarGrid valor={valor} onSelecionar={onSelecionar} />
      <Pressable onPress={onFechar} style={styles.botaoCancelar}>
        <Text style={styles.textoCancelar}>Cancelar</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  botaoCancelar: {
    marginTop: espacamento.md,
    paddingVertical: espacamento.xs + 2,
    alignItems: 'center',
  },
  textoCancelar: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
});
