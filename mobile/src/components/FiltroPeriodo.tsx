import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, CalendarRange } from 'lucide-react-native';
import { CalendarSheet } from './CalendarSheet';
import { dataIsoParaExibicao } from '../lib/data';
import { cores, espacamento, raio } from '../theme';
import type { PeriodoFiltro as PeriodoFiltroValor } from '../types/simulacao';

const OPCOES_PERIODO: { valor: PeriodoFiltroValor; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra' },
];

interface FiltroPeriodoProps {
  periodo: PeriodoFiltroValor | null;
  personalizado: { dataInicio: string; dataFim: string } | null;
  onSelecionarPeriodo: (valor: PeriodoFiltroValor) => void;
  onAplicarPersonalizado: (intervalo: { dataInicio: string; dataFim: string }) => void;
}

// Segmented control dia/semana/mês/safra + botão de período personalizado, extraído de
// ResumoScreen.tsx (spec mobile/08) pra ser reaproveitado em VendasScreen e DespesasScreen —
// mesmo papel do par PeriodToggle/PeriodoPersonalizadoButton do web. Os campos de início/fim
// abrem CalendarSheet (grid de calendário, ver esse arquivo) em vez de pedir digitação manual
// de data — troca feita a pedido do dev (2026-08-03, ver docs/backlog.md) pra igualar à
// experiência do web (DatePickerField + CalendarSheet).
export function FiltroPeriodo({ periodo, personalizado, onSelecionarPeriodo, onAplicarPersonalizado }: FiltroPeriodoProps) {
  const [outraDataAberta, setOutraDataAberta] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [campoCalendarioAberto, setCampoCalendarioAberto] = useState<'inicio' | 'fim' | null>(null);

  function abrirPersonalizado() {
    setDataInicio(personalizado?.dataInicio ?? '');
    setDataFim(personalizado?.dataFim ?? '');
    setOutraDataAberta(true);
  }

  const personalizadoValido = !!dataInicio && !!dataFim && dataInicio <= dataFim;

  function aplicarPersonalizado() {
    if (!personalizadoValido) return;
    onAplicarPersonalizado({ dataInicio, dataFim });
    setOutraDataAberta(false);
  }

  return (
    <View style={{ gap: espacamento.sm }}>
      <View style={styles.segmentado}>
        {OPCOES_PERIODO.map((opcao) => (
          <Pressable
            key={opcao.valor}
            style={[styles.segmento, periodo === opcao.valor && styles.segmentoAtivo]}
            onPress={() => {
              setOutraDataAberta(false);
              onSelecionarPeriodo(opcao.valor);
            }}
          >
            <Text style={[styles.segmentoTexto, periodo === opcao.valor && styles.segmentoTextoAtivo]}>
              {opcao.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.botaoPersonalizado, !!personalizado && styles.botaoPersonalizadoAtivo]} onPress={abrirPersonalizado}>
        <CalendarRange size={16} color={personalizado ? '#FFFFFF' : cores.stone[600]} />
        <Text style={[styles.botaoPersonalizadoTexto, !!personalizado && styles.botaoPersonalizadoTextoAtivo]}>
          {personalizado
            ? `${dataIsoParaExibicao(personalizado.dataInicio)} - ${dataIsoParaExibicao(personalizado.dataFim)}`
            : 'Escolher período personalizado'}
        </Text>
      </Pressable>

      {outraDataAberta && (
        <View style={styles.personalizadoCaixa}>
          <View style={styles.personalizadoLinha}>
            <Pressable style={styles.campoData} onPress={() => setCampoCalendarioAberto('inicio')}>
              <Calendar size={15} color={cores.stone[400]} strokeWidth={2} />
              <Text style={[styles.campoDataTexto, !dataInicio && styles.campoDataPlaceholder]}>
                {dataInicio ? dataIsoParaExibicao(dataInicio) : 'Data início'}
              </Text>
            </Pressable>
            <Pressable style={styles.campoData} onPress={() => setCampoCalendarioAberto('fim')}>
              <Calendar size={15} color={cores.stone[400]} strokeWidth={2} />
              <Text style={[styles.campoDataTexto, !dataFim && styles.campoDataPlaceholder]}>
                {dataFim ? dataIsoParaExibicao(dataFim) : 'Data fim'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.botaoAplicar, !personalizadoValido && styles.botaoAplicarDesabilitado]}
            onPress={aplicarPersonalizado}
            disabled={!personalizadoValido}
          >
            <Text style={styles.textoBotaoAplicar}>Aplicar</Text>
          </Pressable>
        </View>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  segmentado: {
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
  },
  segmentoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  segmentoTextoAtivo: {
    color: cores.green[800],
  },
  botaoPersonalizado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.xs + 2,
    height: 38,
    borderRadius: raio.md + 2,
    backgroundColor: cores.cream[100],
  },
  botaoPersonalizadoAtivo: {
    backgroundColor: cores.green[800],
  },
  botaoPersonalizadoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
  botaoPersonalizadoTextoAtivo: {
    color: '#FFFFFF',
  },
  personalizadoCaixa: {
    gap: espacamento.sm,
    backgroundColor: cores.cream[100],
    borderRadius: raio.md,
    padding: espacamento.md,
  },
  personalizadoLinha: {
    flexDirection: 'row',
    gap: espacamento.sm,
  },
  campoData: {
    flex: 1,
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
    fontSize: 13,
    fontWeight: '600',
    color: cores.stone[900],
  },
  campoDataPlaceholder: {
    fontWeight: '400',
    color: cores.stone[400],
  },
  botaoAplicar: {
    alignSelf: 'flex-start',
    borderRadius: raio.pill,
    backgroundColor: cores.green[800],
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.sm - 1,
  },
  botaoAplicarDesabilitado: {
    opacity: 0.4,
  },
  textoBotaoAplicar: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
