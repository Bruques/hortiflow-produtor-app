import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ShoppingCart, Wallet, Menu as MenuIcon, Plus, CirclePlus, CircleMinus } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafraAtiva } from '../context/SafraContext';
import { cores, espacamento, raio } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

interface Props extends BottomTabBarProps {
  // Navegação do stack raiz (RootNavigator), separada da navegação de aba que o
  // BottomTabBarProps já traz — precisa dela pro FAB abrir NovaVenda/NovaDespesa, que vivem
  // fora do tab navigator (docs/specs/mobile/08-navegacao-resumo-e-menu.md).
  navegacaoRaiz: NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>;
}

const ICONES = {
  Resumo: Home,
  Vendas: ShoppingCart,
  Despesas: Wallet,
  Menu: MenuIcon,
} as const;

const ITENS_ESQUERDA = ['Resumo', 'Vendas'] as const;
const ITENS_DIREITA = ['Despesas', 'Menu'] as const;

// Tab bar customizada da casca de navegação: 4 abas fixas + FAB central que abre a folha "Nova
// venda"/"Nova despesa" — equivalente visual a frontend/src/components/BottomNavV2.tsx, agora
// como `tabBar` de um @react-navigation/bottom-tabs de verdade (ver SafraTabs.tsx).
export function BottomNavTabs({ state, navigation, navegacaoRaiz }: Props) {
  const insets = useSafeAreaInsets();
  const { safraAtiva } = useSafraAtiva();
  const [aberto, setAberto] = useState(false);

  if (!safraAtiva) return null;
  const { safraId, sociedadeId } = safraAtiva;

  const abaAtiva = state.routeNames[state.index];

  function irParaFormulario(rota: 'NovaVenda' | 'NovaDespesa') {
    setAberto(false);
    navegacaoRaiz.navigate(rota, { safraId, sociedadeId });
  }

  function NavItem({ nome }: { nome: keyof typeof ICONES }) {
    const Icon = ICONES[nome];
    const ativo = abaAtiva === nome;
    return (
      <Pressable style={styles.navItem} onPress={() => navigation.navigate(nome)}>
        <Icon size={20} color={ativo ? cores.green[700] : cores.stone[400]} strokeWidth={ativo ? 2.4 : 2} />
        <Text style={[styles.navLabel, ativo && styles.navLabelAtivo]}>{nome}</Text>
      </Pressable>
    );
  }

  return (
    <>
      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={styles.overlay} onPress={() => setAberto(false)} />
        <View style={[styles.folha, { paddingBottom: insets.bottom + espacamento.xl }]}>
          <View style={styles.alcinha} />
          <Text style={styles.folhaTitulo}>O que você quer registrar?</Text>
          <View style={styles.folhaBotoes}>
            <Pressable style={styles.folhaBotao} onPress={() => irParaFormulario('NovaVenda')}>
              <View style={[styles.folhaIcone, { backgroundColor: cores.green[100] }]}>
                <CirclePlus size={24} color={cores.green[600]} />
              </View>
              <Text style={styles.folhaBotaoTexto}>Nova venda</Text>
            </Pressable>
            <Pressable style={styles.folhaBotao} onPress={() => irParaFormulario('NovaDespesa')}>
              <View style={[styles.folhaIcone, { backgroundColor: cores.red.fundo }]}>
                <CircleMinus size={24} color={cores.red.padrao} />
              </View>
              <Text style={styles.folhaBotaoTexto}>Nova despesa</Text>
            </Pressable>
          </View>
          <Pressable style={styles.folhaCancelar} onPress={() => setAberto(false)}>
            <Text style={styles.folhaCancelarTexto}>Cancelar</Text>
          </Pressable>
        </View>
      </Modal>

      <View style={[styles.nav, { paddingBottom: insets.bottom + espacamento.sm }]}>
        {ITENS_ESQUERDA.map((nome) => (
          <NavItem key={nome} nome={nome} />
        ))}
        <View style={{ flex: 1 }} />
        {ITENS_DIREITA.map((nome) => (
          <NavItem key={nome} nome={nome} />
        ))}

        <Pressable style={styles.fab} onPress={() => setAberto(true)} accessibilityLabel="Registrar venda ou despesa">
          <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: cores.linha,
    backgroundColor: '#FFFFFF',
    paddingTop: espacamento.sm + 2,
    paddingHorizontal: espacamento.xs,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  navLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: cores.stone[400],
  },
  navLabelAtivo: {
    color: cores.green[700],
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    top: -24,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: raio.pill,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: cores.green[800],
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  folha: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: raio.lg + 8,
    borderTopRightRadius: raio.lg + 8,
    paddingHorizontal: espacamento.lg,
    paddingTop: espacamento.md,
  },
  alcinha: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: raio.pill,
    backgroundColor: cores.linha,
    marginBottom: espacamento.md,
  },
  folhaTitulo: {
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: cores.stone[400],
    marginBottom: espacamento.md,
  },
  folhaBotoes: {
    flexDirection: 'row',
    gap: espacamento.md,
  },
  folhaBotao: {
    flex: 1,
    alignItems: 'center',
    gap: espacamento.sm,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: raio.lg,
    paddingVertical: espacamento.lg,
  },
  folhaIcone: {
    width: 50,
    height: 50,
    borderRadius: raio.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folhaBotaoTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[900],
  },
  folhaCancelar: {
    marginTop: espacamento.sm + 2,
    paddingVertical: espacamento.sm,
    alignItems: 'center',
  },
  folhaCancelarTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: cores.stone[600],
  },
});
