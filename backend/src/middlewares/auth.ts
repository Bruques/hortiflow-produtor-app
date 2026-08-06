import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

interface TokenPayload {
  usuarioId: string;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { authorization } = req.headers;

  if (!authorization) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const [, token] = authorization.split(' ');

  let usuarioId: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    usuarioId = decoded.usuarioId;
  } catch {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  // Consulta o banco a cada requisição (em vez de confiar só no payload do JWT) para que
  // bloquear uma conta derrube o acesso de uma sessão já em andamento, não só logins futuros.
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { status: true },
  });

  // 401 (não 403): é o único status que o interceptor de logout automático do web e do
  // mobile já reage sem precisar de nenhuma mudança nesses apps (ver bootstrapSessao.ts).
  if (!usuario || usuario.status === 'BLOQUEADO') {
    res.status(401).json({ error: 'Conta suspensa. Entre em contato para reativar.' });
    return;
  }

  req.usuarioId = usuarioId;
  next();
}
