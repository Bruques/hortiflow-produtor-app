import { StyleSheet, Text, View } from 'react-native';
import { useConectividade } from '../lib/useConectividade';

// Banner discreto, não bloqueante (spec 00): o produtor precisa continuar usando o app
// com ele visível, então fica no topo da tela em vez de um modal.
export function BannerSemConexao() {
  const conectado = useConectividade();

  if (conectado) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.texto}>Sem conexão — mostrando últimos dados salvos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#B45309',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  texto: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
});
