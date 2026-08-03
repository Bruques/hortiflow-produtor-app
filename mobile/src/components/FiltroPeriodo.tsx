import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarRange } from 'lucide-react-native';
import { dataIsoParaExibicao, exibicaoParaDataIso } from '../lib/data';
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
// mesmo papel do par PeriodToggle/PeriodoPersonalizadoButton do web, só que combinado num único
// componente porque o mobile ainda não tem um padrão de bottom sheet pra replicar a versão web.
export function FiltroPeriodo({ periodo, personalizado, onSelecionarPeriodo, onAplicarPersonalizado }: FiltroPeriodoProps) {
  const [outraDataAberta, setOutraDataAberta] = useState(false);
  const [textoInicio, setTextoInicio] = useState('');
  const [textoFim, setTextoFim] = useState('');

  function abrirPersonalizado() {
    setTextoInicio(personalizado ? dataIsoParaExibicao(personalizado.dataInicio) : '');
    setTextoFim(personalizado ? dataIsoParaExibicao(personalizado.dataFim) : '');
    setOutraDataAberta(true);
  }

  function aplicarPersonalizado() {
    const dataInicio = exibicaoParaDataIso(textoInicio);
    const dataFim = exibicaoParaDataIso(textoFim);
    if (!dataInicio || !dataFim || dataInicio > dataFim) return;
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
            <TextInput
              style={styles.personalizadoInput}
              value={textoInicio}
              onChangeText={setTextoInicio}
              placeholder="Início DD/MM/AAAA"
              placeholderTextColor={cores.stone[400]}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.personalizadoInput}
              value={textoFim}
              onChangeText={setTextoFim}
              placeholder="Fim DD/MM/AAAA"
              placeholderTextColor={cores.stone[400]}
              keyboardType="numeric"
            />
          </View>
          <Pressable style={styles.botaoAplicar} onPress={aplicarPersonalizado}>
            <Text style={styles.textoBotaoAplicar}>Aplicar</Text>
          </Pressable>
        </View>
      )}
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
  personalizadoInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.md,
    paddingHorizontal: espacamento.sm + 2,
    paddingVertical: espacamento.sm,
    fontSize: 13,
    color: cores.stone[900],
    backgroundColor: '#FFFFFF',
  },
  botaoAplicar: {
    alignSelf: 'flex-start',
    borderRadius: raio.pill,
    backgroundColor: cores.green[800],
    paddingHorizontal: espacamento.lg,
    paddingVertical: espacamento.sm - 1,
  },
  textoBotaoAplicar: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
