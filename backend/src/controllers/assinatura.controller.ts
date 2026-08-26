import { Request, Response } from 'express';
import * as assinaturaService from '../services/assinatura.service';

export async function status(req: Request, res: Response): Promise<void> {
  const status = await assinaturaService.statusDoUsuario(req.usuarioId);
  if (!status) {
    res.status(404).json({ error: 'Assinatura não encontrada' });
    return;
  }
  res.json(status);
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const resultado = await assinaturaService.cancelarAssinaturaDoUsuario(req.usuarioId);
  if ('erro' in resultado) {
    res.status(400).json({ error: 'Nenhuma assinatura ativa pra cancelar' });
    return;
  }
  res.json({ dataFimAcesso: resultado.dataFimAcesso });
}
