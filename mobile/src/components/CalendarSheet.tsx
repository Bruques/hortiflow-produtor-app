import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { cores, espacamento, raio } from '../theme';

export interface CalendarSheetProps {
  aberto: boolean;
  valor: string; // yyyy-mm-dd ou ''
  onSelecionar: (iso: string) => void;
  onFechar: () => void;
}

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function paraIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mesInicial(valor: string): { ano: number; mes: number } {
  const base = valor ? new Date(`${valor}T00:00:00`) : new Date();
  return { ano: base.getFullYear(), mes: base.getMonth() };
}

// Grid de calendário próprio (portado de frontend/src/components/ui/calendar-sheet.tsx), em vez
// de um date picker nativo do sistema — o objetivo aqui (2026-08-03, ver docs/backlog.md) é a
// mesma experiência visual/de marca do web (toca no dia, sem digitar), não só "um calendário
// qualquer", e evita puxar uma dependência nativa nova só pra isso.
export function CalendarSheet({ aberto, valor, onSelecionar, onFechar }: CalendarSheetProps) {
  const insets = useSafeAreaInsets();
  const [{ ano, mes }, setMesExibido] = useState(() => mesInicial(valor));

  useEffect(() => {
    if (aberto) setMesExibido(mesInicial(valor));
  }, [aberto, valor]);

  const hoje = new Date();
  const hojeIso = paraIso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  function irParaMes(delta: number) {
    const novaData = new Date(ano, mes + delta, 1);
    setMesExibido({ ano: novaData.getFullYear(), mes: novaData.getMonth() });
  }

  return (
    <Modal visible={aberto} transparent animationType="slide" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + espacamento.lg }]}>
        <View style={styles.alca} />

        <View style={styles.cabecalho}>
          <Pressable onPress={() => irParaMes(-1)} style={styles.botaoMes} hitSlop={8}>
            <ChevronLeft size={18} color={cores.stone[700]} strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.tituloMes}>
            {MESES[mes]} {ano}
          </Text>
          <Pressable onPress={() => irParaMes(1)} style={styles.botaoMes} hitSlop={8}>
            <ChevronRight size={18} color={cores.stone[700]} strokeWidth={2.3} />
          </Pressable>
        </View>

        <View style={styles.linhaSemana}>
          {DIAS_SEMANA.map((d, i) => (
            <Text key={i} style={styles.diaSemana}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grade}>
          {celulas.map((dia, i) => {
            if (dia === null) return <View key={`vazio-${i}`} style={styles.celula} />;
            const iso = paraIso(ano, mes, dia);
            const selecionado = iso === valor;
            const ehHoje = iso === hojeIso;
            return (
              <View key={iso} style={styles.celula}>
                <Pressable
                  onPress={() => onSelecionar(iso)}
                  style={[
                    styles.diaBotao,
                    selecionado && styles.diaBotaoSelecionado,
                    !selecionado && ehHoje && styles.diaBotaoHoje,
                  ]}
                >
                  <Text
                    style={[
                      styles.diaTexto,
                      selecionado && styles.diaTextoSelecionado,
                      !selecionado && ehHoje && styles.diaTextoHoje,
                    ]}
                  >
                    {dia}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Pressable onPress={onFechar} style={styles.botaoCancelar}>
          <Text style={styles.textoCancelar}>Cancelar</Text>
        </Pressable>
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
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: espacamento.md,
  },
  botaoMes: {
    width: 32,
    height: 32,
    borderRadius: raio.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tituloMes: {
    fontSize: 14.5,
    fontWeight: '800',
    color: cores.stone[900],
  },
  linhaSemana: {
    flexDirection: 'row',
  },
  diaSemana: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: espacamento.xs,
    fontSize: 11,
    fontWeight: '700',
    color: cores.stone[400],
    textTransform: 'uppercase',
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  celula: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  diaBotao: {
    width: 36,
    height: 36,
    borderRadius: raio.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaBotaoSelecionado: {
    backgroundColor: cores.green[800],
  },
  diaBotaoHoje: {
    borderWidth: 1.5,
    borderColor: cores.green[700],
  },
  diaTexto: {
    fontSize: 13.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  diaTextoSelecionado: {
    color: '#FFFFFF',
  },
  diaTextoHoje: {
    color: cores.green[700],
  },
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
