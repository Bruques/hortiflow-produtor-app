import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, Sprout } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { CalendarSheet } from './CalendarSheet';
import { dataIsoParaExibicao } from '../lib/data';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro } from '../types/simulacao';

export interface PeriodoPersonalizado {
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
}

interface PeriodoAvancadoButtonProps {
  periodo: PeriodoFiltro | null;
  personalizado: PeriodoPersonalizado | null;
  onSelecionarPeriodo: (valor: PeriodoFiltro) => void;
  onAplicarPersonalizado: (valor: PeriodoPersonalizado | null) => void;
}

// Botão só de ícone, ao lado do PeriodToggle (que só tem Hoje/Semana/Mês) — abre uma folha com
// "Safra inteira" (que saiu do toggle) e o período personalizado (De/Até), os dois casos que
// não cabem como botão extra do segmented control. Espelha
// frontend/src/components/PeriodoAvancadoButton.tsx (decisão do dev, 2026-08-04).
export function PeriodoAvancadoButton({
  periodo,
  personalizado,
  onSelecionarPeriodo,
  onAplicarPersonalizado,
}: PeriodoAvancadoButtonProps) {
  const [aberto, setAberto] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [campoCalendarioAberto, setCampoCalendarioAberto] = useState<'inicio' | 'fim' | null>(null);

  const safraSelecionada = periodo === 'safra' && !personalizado;
  const ativo = safraSelecionada || !!personalizado;
  const personalizadoValido = !!dataInicio && !!dataFim && dataInicio <= dataFim;

  function abrir() {
    setDataInicio(personalizado?.dataInicio ?? '');
    setDataFim(personalizado?.dataFim ?? '');
    setAberto(true);
  }

  function selecionarSafra() {
    onSelecionarPeriodo('safra');
    setAberto(false);
  }

  function aplicarPersonalizado() {
    if (!personalizadoValido) return;
    onAplicarPersonalizado({ dataInicio, dataFim });
    setAberto(false);
  }

  function removerPersonalizado() {
    onAplicarPersonalizado(null);
    setAberto(false);
  }

  return (
    <>
      <Pressable
        style={[styles.botaoIcone, ativo && styles.botaoIconeAtivo]}
        onPress={abrir}
        accessibilityLabel="Mais períodos: safra inteira ou personalizado"
      >
        <Calendar size={16} color={ativo ? '#FFFFFF' : cores.stone[600]} strokeWidth={2} />
      </Pressable>

      <BottomSheet aberto={aberto} onFechar={() => setAberto(false)}>
        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoIcone}>
            <Calendar size={16} color={cores.green[800]} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cabecalhoTitulo}>Mais períodos</Text>
            <Text style={styles.cabecalhoSubtitulo}>Safra inteira ou um intervalo específico</Text>
          </View>
        </View>

        <Pressable
          style={[styles.cartaoSafra, safraSelecionada && styles.cartaoSafraAtivo]}
          onPress={selecionarSafra}
        >
          <View style={styles.cartaoSafraIcone}>
            <Sprout size={14} color={cores.green[800]} strokeWidth={2.4} />
          </View>
          <Text style={styles.cartaoSafraTexto}>Safra inteira</Text>
          <View style={[styles.radio, safraSelecionada && styles.radioAtivo]} />
        </Pressable>

        <View style={styles.divisorLinha}>
          <View style={styles.divisor} />
          <Text style={styles.divisorTexto}>ou personalizado</Text>
          <View style={styles.divisor} />
        </View>

        <View style={styles.camposData}>
          <View style={styles.campoDataArea}>
            <Text style={styles.campoDataLabel}>Início</Text>
            <Pressable style={styles.campoData} onPress={() => setCampoCalendarioAberto('inicio')}>
              <Calendar size={14} color={cores.stone[400]} strokeWidth={2} />
              <Text style={[styles.campoDataTexto, !dataInicio && styles.campoDataPlaceholder]}>
                {dataInicio ? dataIsoParaExibicao(dataInicio) : 'Selecionar'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.campoDataArea}>
            <Text style={styles.campoDataLabel}>Fim</Text>
            <Pressable style={styles.campoData} onPress={() => setCampoCalendarioAberto('fim')}>
              <Calendar size={14} color={cores.stone[400]} strokeWidth={2} />
              <Text style={[styles.campoDataTexto, !dataFim && styles.campoDataPlaceholder]}>
                {dataFim ? dataIsoParaExibicao(dataFim) : 'Selecionar'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.botaoAplicar, !personalizadoValido && styles.botaoAplicarDesabilitado]}
          onPress={aplicarPersonalizado}
          disabled={!personalizadoValido}
        >
          <Text style={styles.textoBotaoAplicar}>Aplicar</Text>
        </Pressable>

        {personalizado && (
          <Pressable style={styles.botaoRemover} onPress={removerPersonalizado}>
            <Text style={styles.textoBotaoRemover}>Remover filtro personalizado</Text>
          </Pressable>
        )}
      </BottomSheet>

      <CalendarSheet
        aberto={campoCalendarioAberto === 'inicio'}
        valor={dataInicio}
        onSelecionar={(iso) => {
          setDataInicio(iso);
          setCampoCalendarioAberto(null);
        }}
        onFechar={() => setCampoCalendarioAberto(null)}
      />
      <CalendarSheet
        aberto={campoCalendarioAberto === 'fim'}
        valor={dataFim}
        onSelecionar={(iso) => {
          setDataFim(iso);
          setCampoCalendarioAberto(null);
        }}
        onFechar={() => setCampoCalendarioAberto(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  botaoIcone: {
    width: 38,
    height: 38,
    borderRadius: raio.md + 2,
    backgroundColor: cores.cream[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoIconeAtivo: {
    backgroundColor: cores.green[800],
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    marginBottom: espacamento.lg,
  },
  cabecalhoIcone: {
    width: 34,
    height: 34,
    borderRadius: raio.md - 2,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalhoTitulo: {
    fontSize: 14.5,
    fontWeight: '800',
    color: cores.stone[900],
  },
  cabecalhoSubtitulo: {
    fontSize: 11,
    color: cores.stone[600],
    marginTop: 1,
  },
  cartaoSafra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.sm + 2,
    paddingVertical: espacamento.sm + 2,
    marginBottom: espacamento.lg,
  },
  cartaoSafraAtivo: {
    backgroundColor: cores.green[100],
  },
  cartaoSafraIcone: {
    width: 28,
    height: 28,
    borderRadius: raio.sm,
    backgroundColor: cores.green[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoSafraTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  radio: {
    width: 17,
    height: 17,
    borderRadius: raio.pill,
    borderWidth: 1.5,
    borderColor: cores.linha,
  },
  radioAtivo: {
    borderColor: cores.green[800],
    backgroundColor: cores.green[800],
  },
  divisorLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
    marginBottom: espacamento.lg,
  },
  divisor: {
    flex: 1,
    height: 1,
    backgroundColor: cores.linha,
  },
  divisorTexto: {
    fontSize: 10.5,
    fontWeight: '700',
    color: cores.stone[400],
    textTransform: 'uppercase',
  },
  camposData: {
    flexDirection: 'row',
    gap: espacamento.sm,
    marginBottom: espacamento.lg,
  },
  campoDataArea: {
    flex: 1,
    gap: espacamento.xs + 2,
  },
  campoDataLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: cores.stone[400],
    textTransform: 'uppercase',
  },
  campoData: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.sm + 2,
    paddingVertical: espacamento.sm + 2,
    backgroundColor: '#FFFFFF',
  },
  campoDataTexto: {
    fontSize: 12.5,
    fontWeight: '600',
    color: cores.stone[900],
  },
  campoDataPlaceholder: {
    fontWeight: '400',
    color: cores.stone[400],
  },
  botaoAplicar: {
    borderRadius: raio.md,
    backgroundColor: cores.green[800],
    paddingVertical: espacamento.sm + 4,
    alignItems: 'center',
    marginBottom: espacamento.sm,
  },
  botaoAplicarDesabilitado: {
    opacity: 0.4,
  },
  textoBotaoAplicar: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  botaoRemover: {
    alignItems: 'center',
    paddingVertical: espacamento.xs + 2,
  },
  textoBotaoRemover: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
});
