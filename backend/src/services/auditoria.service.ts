import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import Sentry from '../lib/sentry';

export type TipoEventoAuditoria =
  | 'CONTA_CRIADA'
  | 'LOGIN'
  | 'LOGOUT'
  | 'CONTA_BLOQUEADA'
  | 'CONTA_DESBLOQUEADA'
  | 'EXCLUSAO_CONTA';

// Best-effort de propósito (spec 17): gravar o evento nunca pode derrubar a ação principal
// (cadastro/login/logout) que o chamou. Se a gravação falhar, o erro vai pro Sentry, não
// propaga pro controller — por isso essa função nunca lança.
export async function registrarEvento(
  usuarioId: string | null,
  tipo: TipoEventoAuditoria,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.eventoAuditoria.create({
      data: { usuario_id: usuarioId, tipo, metadata: metadata as Prisma.InputJsonValue },
    });
  } catch (erro) {
    Sentry.captureException(erro);
  }
}
