import { PapelSocio, Safra, StatusSafra } from '@prisma/client';
import prisma from '../lib/prisma';
import * as assinaturaService from './assinatura.service';

const TOLERANCIA_SOMA_PERCENTUAL = 0.01;

// Task 23 — sócios da safra informados na criação. Sem `socio_sociedade_id`, cria um sócio
// sem conta novo (mesmo fluxo de docs/specs/02, incremento "sócio sem conta"); com, reaproveita
// um sócio já cadastrado no catálogo da Sociedade (docs/specs/23-socios-por-safra.md).
export interface SocioSafraInput {
  socio_sociedade_id?: string;
  nome?: string;
  papel?: PapelSocio;
  percentual_lucro: number;
}

type AbrirSafraResultado =
  | { erro: 'LIMITE_SAFRAS_ATIVAS' }
  | { erro: 'SOMA_INVALIDA'; soma: number }
  | { erro: 'SOCIO_INVALIDO' }
  | { safra: Safra; socios: Awaited<ReturnType<typeof listarSociosDaSafra>> };

export async function abrirSafra(
  sociedadeId: string,
  usuarioId: string,
  nome: string,
  observacoes?: string,
  socios?: SocioSafraInput[]
): Promise<AbrirSafraResultado> {
  const sociedade = await prisma.sociedade.findUnique({
    where: { id: sociedadeId },
    select: { criado_por_usuario_id: true },
  });
  // Spec 18 — safra sempre nasce EM_ANDAMENTO, então já entra na contagem do limite do
  // plano do titular da sociedade (ver assinatura.service.ts).
  if (sociedade && !(await assinaturaService.podeAtivarSafra(sociedade.criado_por_usuario_id))) {
    return { erro: 'LIMITE_SAFRAS_ATIVAS' };
  }

  if (socios && socios.length > 0) {
    const soma = socios.reduce((acc, s) => acc + s.percentual_lucro, 0);
    if (Math.abs(soma - 100) > TOLERANCIA_SOMA_PERCENTUAL) {
      return { erro: 'SOMA_INVALIDA', soma };
    }

    const idsInformados = socios
      .map((s) => s.socio_sociedade_id)
      .filter((id): id is string => Boolean(id));
    if (idsInformados.length > 0) {
      const existentes = await prisma.socioSociedade.findMany({
        where: { id: { in: idsInformados }, sociedade_id: sociedadeId },
      });
      if (existentes.length !== new Set(idsInformados).size) {
        return { erro: 'SOCIO_INVALIDO' };
      }
    }
  }

  const safra = await prisma.safra.create({
    data: {
      sociedade_id: sociedadeId,
      nome,
      observacoes: observacoes || null,
      status: StatusSafra.EM_ANDAMENTO,
      data_inicio: new Date(),
    },
  });

  if (!socios || socios.length === 0) {
    // Sem lista de sócios: quem está criando trabalha sozinho nessa safra, 100%. O vínculo
    // já existe (precisou ser sócio da sociedade pra chegar até aqui — ver ehSocio no controller).
    const meuVinculo = await prisma.socioSociedade.findUnique({
      where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedadeId } },
    });
    await prisma.socioSafra.create({
      data: { safra_id: safra.id, socio_sociedade_id: meuVinculo!.id, percentual_lucro: 100 },
    });
  } else {
    await prisma.$transaction(async (tx) => {
      for (const s of socios) {
        let socioSociedadeId = s.socio_sociedade_id;
        if (!socioSociedadeId) {
          const novo = await tx.socioSociedade.create({
            data: {
              sociedade_id: sociedadeId,
              nome: s.nome,
              percentual_lucro: 0,
              papel: s.papel ?? PapelSocio.MISTO,
            },
          });
          socioSociedadeId = novo.id;
        }
        await tx.socioSafra.create({
          data: { safra_id: safra.id, socio_sociedade_id: socioSociedadeId, percentual_lucro: s.percentual_lucro },
        });
      }
    });
  }

  return { safra, socios: await listarSociosDaSafra(safra.id) };
}

// Mesmo shape de sociedadesService.listarSocios, só que lendo o percentual de SocioSafra em
// vez de SocioSociedade — permite trocar uma chamada pela outra nos controllers sem mudar
// o resto do código (calcularDivisao, montagem de resposta, etc.).
export async function listarSociosDaSafra(safraId: string) {
  const vinculos = await prisma.socioSafra.findMany({
    where: { safra_id: safraId },
    include: { socioSociedade: { include: { usuario: true } } },
  });

  return vinculos.map((v) => ({
    id: v.socioSociedade.id,
    usuario_id: v.socioSociedade.usuario_id,
    nome: v.socioSociedade.usuario?.nome ?? v.socioSociedade.nome ?? '',
    telefone: v.socioSociedade.usuario?.telefone ?? null,
    percentual_lucro: v.percentual_lucro,
    papel: v.socioSociedade.papel,
  }));
}

export async function listarSafras(sociedadeId: string): Promise<Safra[]> {
  return prisma.safra.findMany({
    where: { sociedade_id: sociedadeId },
    orderBy: { criado_em: 'desc' },
  });
}

// Lista as safras de TODAS as sociedades do usuário, não só uma — base da tela de entrada
// pós-login (docs/design/notas-de-design.md): o usuário pensa em "minhas safras", não em
// "minhas sociedades", então a navegação depois do login parte daqui, não de uma sociedade.
//
// Task 23 — desde que sócios passaram a ser por Safra, "minhas safras" não é mais "toda safra
// da sociedade de que sou sócio": é toda safra em que tenho um SocioSafra, mais toda safra das
// sociedades que eu criei (titular sempre vê tudo que criou, mesmo sem estar na lista de sócios
// daquela safra específica).
export async function listarSafrasDoUsuario(usuarioId: string) {
  const safras = await prisma.safra.findMany({
    where: {
      OR: [
        { sociedade: { criado_por_usuario_id: usuarioId } },
        { sociosSafra: { some: { socioSociedade: { usuario_id: usuarioId } } } },
      ],
    },
    include: { sociedade: { select: { nome: true } } },
    orderBy: { criado_em: 'desc' },
  });

  return safras.map((s) => ({
    id: s.id,
    sociedade_id: s.sociedade_id,
    sociedade_nome: s.sociedade.nome,
    nome: s.nome,
    observacoes: s.observacoes,
    status: s.status,
    data_inicio: s.data_inicio,
    data_fim: s.data_fim,
  }));
}

// Centraliza a checagem "usuário pode ver/lançar dados dessa safra", usada por despesas,
// despesas pessoais, vendas, simulação, relatório e acertos — não duplicar em cada controller.
//
// Task 23 — deixou de ser "é sócio da Sociedade dona da safra" (o que vazava visibilidade
// entre lavouras diferentes da mesma sociedade) e passou a ser "está na lista de sócios
// DESSA safra especificamente" (SocioSafra), com uma exceção: o titular da sociedade (quem
// a criou, dono da assinatura) sempre tem acesso, mesmo sem constar explicitamente na lista.
export async function ehSocioDaSafra(
  usuarioId: string,
  safraId: string
): Promise<{ safra: Safra | null; autorizado: boolean }> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) {
    return { safra: null, autorizado: false };
  }

  const sociedade = await prisma.sociedade.findUnique({
    where: { id: safra.sociedade_id },
    select: { criado_por_usuario_id: true },
  });
  if (sociedade?.criado_por_usuario_id === usuarioId) {
    return { safra, autorizado: true };
  }

  const vinculo = await prisma.socioSafra.findFirst({
    where: { safra_id: safraId, socioSociedade: { usuario_id: usuarioId } },
  });
  return { safra, autorizado: vinculo !== null };
}

export async function atualizarObservacoes(
  safraId: string,
  observacoes: string | null
): Promise<Safra | null> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) return null;

  return prisma.safra.update({
    where: { id: safraId },
    data: { observacoes },
  });
}

export async function atualizarNome(safraId: string, nome: string): Promise<Safra | null> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) return null;

  return prisma.safra.update({
    where: { id: safraId },
    data: { nome },
  });
}

type EncerrarResultado =
  | { erro: 'NAO_ENCONTRADA' }
  | { erro: 'JA_ENCERRADA' }
  | { safra: Safra };

export async function encerrarSafra(safraId: string): Promise<EncerrarResultado> {
  const safra = await prisma.safra.findUnique({ where: { id: safraId } });
  if (!safra) {
    return { erro: 'NAO_ENCONTRADA' };
  }
  if (safra.status === StatusSafra.ENCERRADA) {
    return { erro: 'JA_ENCERRADA' };
  }

  const atualizada = await prisma.safra.update({
    where: { id: safraId },
    data: { status: StatusSafra.ENCERRADA, data_fim: new Date() },
  });

  return { safra: atualizada };
}
