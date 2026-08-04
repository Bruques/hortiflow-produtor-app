import { Check, ChevronDown, Circle, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { cores, espacamento, raio } from '../theme';

export type StatusPagamento = 'todas' | 'pagas' | 'a_receber';

const OPCOES: { valor: StatusPagamento; label: string; Icone: LucideIcon }[] = [
  { valor: 'todas', label: 'Todas', Icone: Circle },
  { valor: 'pagas', label: 'Pagas', Icone: Check },
  { valor: 'a_receber', label: 'A receber', Icone: Clock },
];

// Cor do chip fechado por valor selecionado — dá pra "ler" o filtro ativo sem abrir a folha.
const COR_CHIP: Record<StatusPagamento, { fundo: string; texto: string }> = {
  todas: { fundo: cores.cream[100], texto: cores.stone[700] },
  pagas: { fundo: cores.green[100], texto: cores.green[800] },
  a_receber: { fundo: cores.amber.fundo, texto: cores.amber.padrao },
};

interface FiltroStatusPagamentoProps {
  valor: StatusPagamento;
  onSelecionar: (valor: StatusPagamento) => void;
}

// Filtro de status de pagamento da tela de Vendas — não existia no mobile (fora do escopo de
// docs/specs/mobile/06-vendas-e-despesa-recorrente.md); adicionado pra manter paridade com o
// web (frontend/src/components/FiltroStatusPagamentoDropdown.tsx, decisão 2026-08-04). Gatilho
// é um chip compacto colorido com legenda "Status da venda" acima; a folha mostra cada opção
// como um cartão com contorno.
export function FiltroStatusPagamento({ valor, onSelecionar }: FiltroStatusPagamentoProps) {
  const [aberto, setAberto] = useState(false);
  const opcaoAtual = OPCOES.find((o) => o.valor === valor) ?? OPCOES[0];
  const cor = COR_CHIP[valor];

  return (
    <>
      <View style={styles.area}>
        <Text style={styles.legenda}>Status da venda</Text>
        <Pressable
          style={[styles.chip, { backgroundColor: cor.fundo }]}
          onPress={() => setAberto(true)}
          accessibilityLabel="Filtrar por status de pagamento"
        >
          <opcaoAtual.Icone size={14} color={cor.texto} strokeWidth={2.5} />
          <Text style={[styles.chipTexto, { color: cor.texto }]}>{opcaoAtual.label}</Text>
          <ChevronDown size={12} color={cor.texto} strokeWidth={2.5} />
        </Pressable>
      </View>

      <BottomSheet aberto={aberto} onFechar={() => setAberto(false)}>
        <Text style={styles.tituloSheet}>Status de pagamento</Text>
        <Text style={styles.subtituloSheet}>O que você quer ver na lista</Text>

        <View style={{ gap: espacamento.sm }}>
          {OPCOES.map((opcao) => {
            const selecionado = valor === opcao.valor;
            return (
              <Pressable
                key={opcao.valor}
                style={[styles.cartao, selecionado && styles.cartaoSelecionado]}
                onPress={() => {
                  onSelecionar(opcao.valor);
                  setAberto(false);
                }}
              >
                <View style={styles.cartaoConteudo}>
                  <View style={[styles.cartaoIcone, selecionado && styles.cartaoIconeSelecionado]}>
                    <opcao.Icone size={14} color={selecionado ? '#FFFFFF' : cores.stone[600]} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.cartaoTexto}>{opcao.label}</Text>
                </View>
                {selecionado && (
                  <View style={styles.cartaoCheck}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  area: {
    alignSelf: 'flex-start',
    gap: espacamento.xs,
  },
  legenda: {
    fontSize: 10,
    fontWeight: '700',
    color: cores.stone[400],
    textTransform: 'uppercase',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.xs + 2,
    borderRadius: raio.pill,
    paddingHorizontal: espacamento.md,
    paddingVertical: espacamento.sm - 1,
  },
  chipTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  tituloSheet: {
    fontSize: 15,
    fontWeight: '800',
    color: cores.stone[900],
  },
  subtituloSheet: {
    fontSize: 11.5,
    color: cores.stone[600],
    marginTop: 2,
    marginBottom: espacamento.md,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacamento.sm + 2,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingHorizontal: espacamento.md - 2,
    paddingVertical: espacamento.sm + 4,
  },
  cartaoSelecionado: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[100],
  },
  cartaoConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacamento.sm + 2,
  },
  cartaoIcone: {
    width: 28,
    height: 28,
    borderRadius: raio.pill,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoIconeSelecionado: {
    borderColor: cores.green[700],
    backgroundColor: cores.green[700],
  },
  cartaoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.stone[900],
  },
  cartaoCheck: {
    width: 20,
    height: 20,
    borderRadius: raio.pill,
    backgroundColor: cores.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
