import * as Sentry from '@sentry/react-native';

// Espelha backend/src/lib/sentry.ts: só inicializa se houver DSN configurado, pra não
// quebrar o app em desenvolvimento antes do projeto Sentry existir. `beforeSend` descarta
// erro de rede esperado (offline, timeout) e 401 (já tratado como logout automático,
// spec mobile/01) — só exceção de verdade deve virar ruído no Sentry (spec 17).
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    beforeSend(event, hint) {
      const erro = hint?.originalException;
      if (isErroDeRedeEsperado(erro)) {
        return null;
      }
      return event;
    },
  });
}

function isErroDeRedeEsperado(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') {
    return false;
  }
  const comoRegistro = erro as { isAxiosError?: boolean; response?: { status?: number } };
  if (!comoRegistro.isAxiosError) {
    return false;
  }
  // Sem `response` = falha de rede (offline/timeout); status 401 = sessão expirada, já
  // tratada pelo logout automático (AuthContext) — nenhum dos dois é bug de aplicação.
  return comoRegistro.response === undefined || comoRegistro.response.status === 401;
}

export default Sentry;
