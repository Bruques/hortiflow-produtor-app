import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

interface AdminTokenPayload {
  adminId: string;
}

// Spec 18 — equivalente ao authMiddleware, mas pro login de admin (AdminUsuario),
// totalmente separado do login de produtor (Usuario). Protege todas as rotas /api/admin/*.
export async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { authorization } = req.headers;

  if (!authorization) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const [, token] = authorization.split(' ');

  let adminId: string;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminTokenPayload;
    if (!decoded.adminId) throw new Error('token não é de admin');
    adminId = decoded.adminId;
  } catch {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  const admin = await prisma.adminUsuario.findUnique({ where: { id: adminId } });
  if (!admin) {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  req.adminId = adminId;
  next();
}
