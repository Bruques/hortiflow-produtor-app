import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { sincronizarTudo } from './syncQueue';

// Mesmo critério de useConectividade.ts: só `isConnected`, sem `isInternetReachable` (instável
// no Android — ver comentário lá). Usar o sinal de alcance aqui também arriscava o inverso: uma
// falsa leitura de "não alcança a internet" nunca marcava `conectadoAgora` como true, e a
// sincronização automática ao reconectar simplesmente não disparava.
function estaConectado(estado: NetInfoState): boolean {
  return estado.isConnected === true;
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
