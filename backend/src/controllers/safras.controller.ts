import { Request, Response } from 'express';
import { z } from 'zod';
import { PapelSocio } from '@prisma/client';
import * as safrasService from '../services/safras.service';
import * as sociedadesService from '../services/sociedades.service';

const abrirSchema = z.object({
  nome: z.string().min(1),
  observacoes: z.string().max(500).optional(),
  socios: z
    .array(
      z.object({
        socio_sociedade_id: z.string().min(1).optional(),
        nome: z.string().min(1).optional(),
        papel: z.nativeEnum(PapelSocio).optional(),
        percentual_lucro: z.number().min(0).max(100),
      })
    )
    .optional(),
});

const novoSocioSafraSchema = z.object({
  socio_sociedade_id: z.string().min(1).optional(),
  nome: z.string().min(1).optional(),
  papel: z.nativeEnum(PapelSocio).optional(),
});

const percentuaisSafraSchema = z.object({
  socios: z
    .array(
      z.object({
        socio_sociedade_id: z.string().min(1),
        percentual_lucro: z.number().min(0).max(100),
      })
    )
    .min(1),
});

const observacoesSchema = z.object({
  observacoes: z.string().max(500).nullable(),
});

const nomeSchema = z.object({
  nome: z.string().min(1),
});

export async function listarMinhas(req: Request, res: Response): Promise<void> {
  const safras = await safrasService.listarSafrasDoUsuario(req.usuarioId);
  res.json({ safras });
}

export async function abrir(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = abrirSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nome da safra é obrigatório' });
    return;
  }

  const resultado = await safrasService.abrirSafra(
    id,
    req.usuarioId,
    parsed.data.nome,
    parsed.data.observacoes,
    parsed.data.socios
  );
  if ('erro' in resultado) {
    if (resultado.erro === 'LIMITE_SAFRAS_ATIVAS') {
      res.status(403).json({
        error: 'Você atingiu o limite de safras ativas do seu plano. Encerre uma safra em andamento ou fale com a gente sobre um plano com mais espaço.',
      });
      return;
    }
    if (resultado.erro === 'SOMA_INVALIDA') {
      res.status(422).json({
        error: `A soma dos percentuais dos sócios precisa ser 100%. Soma recebida: ${resultado.soma}%`,
      });
      return;
    }
    res.status(404).json({ error: 'Um dos sócios informados não pertence a essa sociedade' });
    return;
  }

  res.status(201).json({ safra: resultado.safra, socios: resultado.socios });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // sociedade id

  const autorizado = await sociedadesService.ehSocio(req.usuarioId, id);
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const safras = await safrasService.listarSafras(id);
  res.json({ safras });
}

export async function obter(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  res.json({ safra });
}

export async function listarSocios(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa safra' });
    return;
  }

  const socios = await safrasService.listarSociosDaSafra(id);
  res.json({ socios });
}

export async function criarSocio(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa safra' });
    return;
  }

  const parsed = novoSocioSafraSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.socio_sociedade_id && !parsed.data.nome)) {
    res.status(400).json({ error: 'Informe socio_sociedade_id (sócio já cadastrado) ou nome (sócio novo)' });
    return;
  }

  const resultado = await safrasService.criarSocioNaSafra(id, safra.sociedade_id, parsed.data);
  if ('erro' in resultado) {
    if (resultado.erro === 'JA_NA_SAFRA') {
      res.status(409).json({ error: 'Esse sócio já participa dessa safra' });
      return;
    }
    res.status(404).json({ error: 'Sócio não encontrado nessa sociedade' });
    return;
  }

  res.status(201).json(resultado);
}

export async function atualizarPercentuaisSocios(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa safra' });
    return;
  }

  const parsed = percentuaisSafraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Lista de sócios com percentual_lucro é obrigatória' });
    return;
  }

  const resultado = await safrasService.atualizarPercentuaisDaSafra(id, parsed.data.socios);
  if ('erro' in resultado) {
    if (resultado.erro === 'SOCIOS_FALTANDO') {
      res.status(422).json({ error: 'A lista precisa cobrir todos os sócios atuais dessa safra' });
      return;
    }
    res.status(422).json({
      error: `A soma dos percentuais precisa ser 100%. Soma recebida: ${resultado.soma}%`,
    });
    return;
  }

  res.json(resultado);
}

export async function removerSocio(req: Request, res: Response): Promise<void> {
  const { id, socioId } = req.params; // safra id, socio_sociedade id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa safra' });
    return;
  }

  const resultado = await safrasService.removerSocioDaSafra(id, socioId, req.usuarioId);
  if ('erro' in resultado) {
    if (resultado.erro === 'NAO_ENCONTRADO') {
      res.status(404).json({ error: 'Sócio não encontrado nessa safra' });
      return;
    }
    if (resultado.erro === 'UNICO_SOCIO') {
      res.status(409).json({ error: 'Não é possível remover o único sócio da safra' });
      return;
    }
    if (resultado.erro === 'AUTO_REMOCAO') {
      res.status(409).json({ error: 'Você não pode remover a si mesmo da safra — peça a outro sócio' });
      return;
    }
    res.status(409).json({ error: 'Esse sócio já tem lançamentos vinculados nessa safra e não pode ser removido' });
    return;
  }

  res.json(resultado);
}

export async function atualizarObservacoes(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = observacoesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Observações muito longas (máximo 500 caracteres)' });
    return;
  }

  const atualizada = await safrasService.atualizarObservacoes(id, parsed.data.observacoes);
  res.json({ safra: atualizada });
}

export async function atualizarNome(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const parsed = nomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Nome da safra é obrigatório' });
    return;
  }

  const atualizada = await safrasService.atualizarNome(id, parsed.data.nome);
  res.json({ safra: atualizada });
}

export async function encerrar(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // safra id

  const { safra, autorizado } = await safrasService.ehSocioDaSafra(req.usuarioId, id);
  if (!safra) {
    res.status(404).json({ error: 'Safra não encontrada' });
    return;
  }
  if (!autorizado) {
    res.status(403).json({ error: 'Você não é sócio dessa sociedade' });
    return;
  }

  const resultado = await safrasService.encerrarSafra(id);
  if ('erro' in resultado) {
    if (resultado.erro === 'NAO_ENCONTRADA') {
      res.status(404).json({ error: 'Safra não encontrada' });
      return;
    }
    res.status(409).json({ error: 'Safra já está encerrada' });
    return;
  }

  res.json({ safra: resultado.safra });
}
