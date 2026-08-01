import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { sincronizarTudo } from './syncQueue';

function estaConectado(estado: NetInfoState): boolean {
  return estado.isConnected === true && estado.isInternetReachable !== false;
}

// Só dispara ao **voltar** a ficar online (offline → online), não em toda mudança de estado —
// evita chamar `sincronizarTudo` repetidamente enquanto já está conectado.
export function deveDispararSincronizacao(estavaConectado: boolean, conectadoAgora: boolean): boolean {
  return conectadoAgora && !estavaConectado;
}

// Assina mudanças de conectividade pela vida do app e dispara a fila de sincronização
// automaticamente ao reconectar — nenhuma ação manual do produtor (critério de aceite da
// spec 00). Chamado uma vez no bootstrap do app (App.tsx).
export function iniciarSincronizacaoAutomatica(): () => void {
  let ultimoEstadoConectado = true;

  return NetInfo.addEventListener((estado) => {
    const conectadoAgora = estaConectado(estado);
    if (deveDispararSincronizacao(ultimoEstadoConectado, conectadoAgora)) {
      sincronizarTudo();
    }
    ultimoEstadoConectado = conectadoAgora;
  });
}
