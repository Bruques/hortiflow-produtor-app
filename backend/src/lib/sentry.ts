import * as Sentry from '@sentry/node';

// Só inicializa se houver DSN configurado — sem isso, rodar localmente (ou em staging antes
// de você criar o projeto no Sentry) quebraria o boot do servidor por falta de credencial.
// Sentry.captureException vira um no-op automático quando o SDK nunca foi inicializado.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

export default Sentry;
