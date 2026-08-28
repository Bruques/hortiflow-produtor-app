import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { registrarEvento } from '../services/auditoria.service';
import { criarAssinaturaTrial } from '../services/assinatura.service';
import { excluirConta } from '../services/excluirConta.service';

const registerSchema = z.object({
  nome: z.string().min(1),
  telefone: z.string().min(1),
  senha: z.string().min(6),
});

const loginSchema = z.object({
  telefone: z.string().min(1),
  senha: z.string().min(1),
});

const trocarSenhaSchema = z.object({
  senha_atual: z.string().min(1),
  senha_nova: z.string().min(6),
});

const excluirContaSchema = z.object({
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

  await registrarEvento(usuario.id, 'CONTA_CRIADA');
  await criarAssinaturaTrial(usuario.id);

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

  if (usuario.status === 'BLOQUEADO') {
    res.status(401).json({ error: 'Conta suspensa. Entre em contato para reativar.' });
    return;
  }

  await registrarEvento(usuario.id, 'LOGIN');

  const token = gerarToken(usuario.id);
  res.json({
    usuario: { id: usuario.id, nome: usuario.nome, telefone: usuario.telefone },
    token,
  });
}

// Sem authMiddleware de propósito: no logout automático (token expirado), uma chamada
// autenticada já falharia com 401 de novo, então essa rota só decodifica o token (sem
// validar assinatura/expiração) para saber de quem é o evento — não é um limite de
// segurança, é só atribuição de um registro de auditoria (spec 17).
export async function logout(req: Request, res: Response): Promise<void> {
  const { authorization } = req.headers;
  const automatico = req.body?.automatico === true;

  let usuarioId: string | null = null;
  if (authorization) {
    const [, token] = authorization.split(' ');
    const payload = jwt.decode(token) as { usuarioId?: string } | null;
    usuarioId = payload?.usuarioId ?? null;
  }

  await registrarEvento(usuarioId, 'LOGOUT', { automatico });
  res.json({ ok: true });
}

export async function trocarSenha(req: Request, res: Response): Promise<void> {
  const parsed = trocarSenhaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Senha atual e nova senha (mínimo 6 caracteres) são obrigatórias' });
    return;
  }

  const { senha_atual, senha_nova } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuarioId } });
  if (!usuario) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  const senhaAtualValida = await bcrypt.compare(senha_atual, usuario.senha_hash);
  if (!senhaAtualValida) {
    res.status(401).json({ error: 'Senha atual incorreta' });
    return;
  }

  const senhaNovaIgualAtual = await bcrypt.compare(senha_nova, usuario.senha_hash);
  if (senhaNovaIgualAtual) {
    res.status(400).json({ error: 'A nova senha precisa ser diferente da atual' });
    return;
  }

  const senha_hash = await bcrypt.hash(senha_nova, 10);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senha_hash } });

  res.json({ ok: true });
}

// Spec 20 — exige a senha atual mesmo com token válido, mesma cautela da troca de senha,
// mas aqui o efeito é irreversível. O evento de auditoria é gravado antes da exclusão em si
// (a linha `Usuario` pode deixar de existir ou ser anonimizada logo em seguida).
export async function excluirContaController(req: Request, res: Response): Promise<void> {
  const parsed = excluirContaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Senha é obrigatória' });
    return;
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuarioId } });
  if (!usuario) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  const senhaValida = await bcrypt.compare(parsed.data.senha, usuario.senha_hash);
  if (!senhaValida) {
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }

  await registrarEvento(usuario.id, 'EXCLUSAO_CONTA');
  await excluirConta(usuario.id);

  res.json({ mensagem: 'Conta excluída com sucesso.' });
}
