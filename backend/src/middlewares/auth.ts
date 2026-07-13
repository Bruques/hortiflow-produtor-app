import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  usuarioId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { authorization } = req.headers;

  if (!authorization) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const [, token] = authorization.split(' ');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    req.usuarioId = decoded.usuarioId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
