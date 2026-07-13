import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';

const registerSchema = z.object({
  nome: z.string().min(1),
  telefone: z.string().min(1),
  senha: z.string().min(6),
});

const loginSchema = z.object({
  telefone: z.string().min(1),
  senha: z.string().min(1),
});

function gerarToken(usuarioId: string): string {
  return jwt.sign({ usuarioId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nome, telefone e senha (mínimo 6 caracteres) são obrigatórios' });
    return;
  }

  const { nome, telefone, senha } = parsed.data;

  const existente = await prisma.usuario.findUnique({ where: { telefone } });
  if (existente) {
    res.status(409).json({ error: 'Telefone já cadastrado' });
    return;
  }

  const senha_hash = await bcrypt.hash(senha, 10);
  const usuario = await prisma.usuario.create({
    data: { nome, telefone, senha_hash },
  });

  const token = gerarToken(usuario.id);
  res.status(201).json({
    usuario: { id: usuario.id, nome: usuario.nome, telefone: usuario.telefone },
    token,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuarioId } });
  if (!usuario) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }
  res.json({ usuario: { id: usuario.id, nome: usuario.nome, telefone: usuario.telefone } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Telefone e senha são obrigatórios' });
    return;
  }

  const { telefone, senha } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { telefone } });

  // Mesmo erro para telefone não encontrado e senha errada — não revela qual falhou
  if (!usuario) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const token = gerarToken(usuario.id);
  res.json({
    usuario: { id: usuario.id, nome: usuario.nome, telefone: usuario.telefone },
    token,
  });
}
