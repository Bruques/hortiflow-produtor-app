import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { CalendarSheet } from './CalendarSheet';
import { cores, espacamento, raio } from '../theme';

export interface DateSelectorChipProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function rotulo(iso: string): string {
  if (!iso) return 'Selecionar data';
  const [ano, mes, dia] = iso.split('-').map(Number);
  const texto = `${dia} ${MESES_ABREV[mes - 1]}`;
  return iso === hojeISO() ? `Hoje, ${texto}` : texto;
}

// Chip único que substitui o antigo par "Hoje" / "Outra data" (que abria um campo de texto pra
// digitar dd/mm/aaaa) — sempre mostra a data escolhida (hoje, por padrão) e abre o CalendarSheet
// ao ser tocado. Ícone de calendário + seta indicam que é um seletor, não um rótulo estático
// (wireframe aprovado em 2026-08-05) — equivalente RN de
// frontend/src/components/ui/date-selector-chip.tsx.
export function DateSelectorChip({ value, onChange }: DateSelectorChipProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Pressable style={styles.chip} onPress={() => setAberto(true)}>
        <Calendar size={13} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.texto}>{rotulo(value)}</Text>
        <ChevronDown size={11} color="#FFFFFF" strokeWidth={2.6} />
      </Pressable>

      <CalendarSheet
        aberto={aberto}
        valor={value}
        onSelecionar={(iso) => {
          onChange(iso);
          setAberto(false);
        }}
        onFechar={() => setAberto(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacamento.xs + 2,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm,
  },
  texto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
