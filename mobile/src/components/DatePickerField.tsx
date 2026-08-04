import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { CalendarSheet } from './CalendarSheet';
import { dataIsoParaExibicao } from '../lib/data';
import { cores, espacamento, raio } from '../theme';

export interface DatePickerFieldProps {
  value: string; // yyyy-mm-dd ou ''
  onChange: (value: string) => void;
  placeholder?: string;
}

// Botão que abre um CalendarSheet em vez do usuário ter que digitar a data — equivalente RN de
// frontend/src/components/ui/date-picker-field.tsx, extraído do padrão já usado em
// PeriodoAvancadoButton.tsx pra virar reutilizável em qualquer tela com campo de data.
export function DatePickerField({ value, onChange, placeholder = 'Selecionar data' }: DatePickerFieldProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Pressable style={styles.campo} onPress={() => setAberto(true)}>
        <Calendar size={17} color={cores.stone[400]} strokeWidth={2} />
        <Text style={[styles.texto, !value && styles.placeholder]}>
          {value ? dataIsoParaExibicao(value) : placeholder}
        </Text>
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
  campo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    height: 44,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.md,
    backgroundColor: '#FFFFFF',
  },
  texto: {
    fontSize: 14,
    fontWeight: '600',
    color: cores.stone[900],
  },
  placeholder: {
    fontWeight: '400',
    color: cores.stone[400],
  },
});
