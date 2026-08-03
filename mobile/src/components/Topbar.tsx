import { StyleSheet, Text, View } from 'react-native';
import { BrandIcon } from './BrandMark';
import { cores, fontes } from '../theme';

// Equivalente a frontend/src/components/Topbar.tsx: aparece em toda tela com bottom nav
// (docs/specs/mobile/08-navegacao-resumo-e-menu.md). Sem hambúrguer nem sino — Menu é uma aba
// própria da casca, e notificações não existem no produto ainda. `BrandLockup` de BrandMark.tsx
// é vertical (feito pra tela de splash/login), por isso a composição horizontal fica aqui, e
// não como mais uma variante genérica dentro de BrandMark.tsx.
export function Topbar() {
  return (
    <View style={styles.container}>
      <BrandIcon tamanho={30} />
      <View>
        <Text style={styles.nome}>HortiFlow</Text>
        <Text style={styles.sufixo}>PRODUTOR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
    paddingTop: 8,
  },
  nome: {
    fontFamily: fontes.titulo,
    fontSize: 15,
    fontWeight: '800',
    color: cores.green[700],
    lineHeight: 17,
  },
  sufixo: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: cores.green[600],
  },
});
