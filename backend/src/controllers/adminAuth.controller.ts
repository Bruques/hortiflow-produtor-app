import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';

const loginSchema = z.object({
  email: z.string().min(1),
  senha: z.string().min(1),
});

// Token separado do login de produtor: payload próprio (`adminId`, não `usuarioId`) pra
// não correr o risco de um token de admin ser aceito por engano nas rotas de produtor
// (authMiddleware) nem vice-versa, mesmo os dois usando o mesmo JWT_SECRET.
function gerarToken(adminId: string): string {
  return jwt.sign({ adminId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    return;
  }

  const { email, senha } = parsed.data;

  const admin = await prisma.adminUsuario.findUnique({ where: { email } });
  if (!admin) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const senhaValida = await bcrypt.compare(senha, admin.senha_hash);
  if (!senhaValida) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const token = gerarToken(admin.id);
  res.json({ admin: { id: admin.id, nome: admin.nome, email: admin.email }, token });
}
