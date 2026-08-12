import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// Só `isConnected` (rádio conectado a wifi/dados) decide o banner — `isInternetReachable` é
// conhecidamente instável no Android (a própria lib documenta falso-negativo: a checagem ativa
// de alcance à internet pode falhar por motivos que não são "o produtor está sem internet", ex:
// DNS lento, o host de teste da lib bloqueado por firewall/operadora), e usá-lo aqui piscava o
// banner "sem conexão" com o aparelho plenamente online (bug relatado 2026-08-12). `isConnected`
// sozinho é menos preciso pra casos raros (wifi conectado mas sem saída pra internet), mas é
// muito mais estável — prefere menos falsos positivos a mais precisão nesse caso.
export function useConectividade(): boolean {
  const [conectado, setConectado] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((estado) => {
      setConectado(estado.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  return conectado;
}
