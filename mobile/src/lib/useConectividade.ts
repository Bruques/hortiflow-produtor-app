import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// `isConnected` já cobre o caso comum (sem rádio/wifi); `isInternetReachable` pode ficar
// `null` momentaneamente enquanto o NetInfo ainda está checando — nesse meio-tempo tratamos
// como conectado para não piscar o banner "sem conexão" à toa a cada abertura de tela.
export function useConectividade(): boolean {
  const [conectado, setConectado] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((estado) => {
      const semConexao = estado.isConnected === false || estado.isInternetReachable === false;
      setConectado(!semConexao);
    });
    return unsubscribe;
  }, []);

  return conectado;
}
