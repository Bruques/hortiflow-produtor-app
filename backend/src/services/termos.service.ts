import prisma from '../lib/prisma';
import { TERMOS_VERSAO_ATUAL, PRIVACIDADE_VERSAO_ATUAL } from '../lib/termosConfig';

export async function aceitePendente(usuarioId: string): Promise<boolean> {
  const ultimoAceite = await prisma.aceiteTermos.findFirst({
    where: { usuario_id: usuarioId },
    orderBy: { aceito_em: 'desc' },
  });

  return (
    ultimoAceite?.versao_termos !== TERMOS_VERSAO_ATUAL ||
    ultimoAceite?.versao_privacidade !== PRIVACIDADE_VERSAO_ATUAL
  );
}

export async function registrarAceite(usuarioId: string): Promise<void> {
  await prisma.aceiteTermos.create({
    data: {
      usuario_id: usuarioId,
      versao_termos: TERMOS_VERSAO_ATUAL,
      versao_privacidade: PRIVACIDADE_VERSAO_ATUAL,
    },
  });
}
