import { Request, Response } from 'express';
import { aceitePendente, registrarAceite } from '../services/termos.service';
import { registrarEvento } from '../services/auditoria.service';
import { TERMOS_VERSAO_ATUAL, PRIVACIDADE_VERSAO_ATUAL } from '../lib/termosConfig';

export async function status(req: Request, res: Response): Promise<void> {
  const pendente = await aceitePendente(req.usuarioId);
  res.json({
    pendente,
    versaoTermosAtual: TERMOS_VERSAO_ATUAL,
    versaoPrivacidadeAtual: PRIVACIDADE_VERSAO_ATUAL,
  });
}

export async function aceite(req: Request, res: Response): Promise<void> {
  await registrarAceite(req.usuarioId);
  await registrarEvento(req.usuarioId, 'ACEITE_TERMOS', {
    versaoTermos: TERMOS_VERSAO_ATUAL,
    versaoPrivacidade: PRIVACIDADE_VERSAO_ATUAL,
  });
  res.json({ ok: true });
}
