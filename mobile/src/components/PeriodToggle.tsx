import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro } from '../types/simulacao';

const TODAS_OPCOES: { valor: PeriodoFiltro; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra' },
];

interface PeriodToggleProps {
  // null quando um período personalizado ou "Safra" (ver PeriodoAvancadoButton) está ativo —
  // nenhum dos botões fica marcado nesse caso.
  valor: PeriodoFiltro | null;
  onSelecionar: (valor: PeriodoFiltro) => void;
  // false nas telas de listagem (Resumo/Vendas/Despesas): "Safra" mora dentro do
  // PeriodoAvancadoButton ao lado, junto do período personalizado — espelha o mesmo split do
  // web (frontend/src/components/PeriodToggle.tsx, decisão 2026-08-04).
  incluirSafra?: boolean;
}

// Segmented control reaproveitado em qualquer tela que filtre por período — substitui o antigo
// FiltroPeriodo.tsx (que já embutia o período personalizado inline). Espelha
// frontend/src/components/PeriodToggle.tsx.
export function PeriodToggle({ valor, onSelecionar, incluirSafra = true }: PeriodToggleProps) {
  const opcoes = incluirSafra ? TODAS_OPCOES : TODAS_OPCOES.filter((o) => o.valor !== 'safra');

  return (
    <View style={styles.segmentado}>
      {opcoes.map((opcao) => (
        <Pressable
          key={opcao.valor}
          style={[styles.segmento, valor === opcao.valor && styles.segmentoAtivo]}
          onPress={() => onSelecionar(opcao.valor)}
        >
          <Text style={[styles.segmentoTexto, valor === opcao.valor && styles.segmentoTextoAtivo]}>
            {opcao.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentado: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    backgroundColor: cores.cream[100],
    borderRadius: raio.md + 2,
    padding: 4,
  },
  segmento: {
    flex: 1,
    borderRadius: raio.sm + 2,
    paddingVertical: espacamento.sm,
    alignItems: 'center',
  },
  segmentoAtivo: {
    backgroundColor: '#FFFFFF',
    // Equivalente ao shadow-sm do Tailwind (web), pra manter o mesmo destaque do item ativo.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  segmentoTextoAtivo: {
    color: cores.green[800],
  },
});
