import { PapelSocio } from '@prisma/client';
import prisma from '../lib/prisma';

const TOLERANCIA_SOMA_PERCENTUAL = 0.01;

function gerarCodigoConvite(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function gerarCodigoConviteUnico(): Promise<string> {
  // Colisão em 6 dígitos é raríssima, mas confere no banco antes de aceitar
  let codigo = gerarCodigoConvite();
  while (await prisma.sociedade.findUnique({ where: { codigo_convite: codigo } })) {
    codigo = gerarCodigoConvite();
  }
  return codigo;
}

export async function criarSociedade(usuarioId: string, nome: string) {
  const codigo_convite = await gerarCodigoConviteUnico();

  const sociedade = await prisma.sociedade.create({
    data: {
      nome,
      codigo_convite,
      socios: {
        create: {
          usuario_id: usuarioId,
          percentual_lucro: 100,
          papel: PapelSocio.MISTO,
        },
      },
    },
    include: { socios: true },
  });

  return {
    sociedade: {
      id: sociedade.id,
      nome: sociedade.nome,
      codigo_convite: sociedade.codigo_convite,
    },
    socio: {
      percentual_lucro: sociedade.socios[0].percentual_lucro,
      papel: sociedade.socios[0].papel,
    },
  };
}

export async function entrarPorCodigo(usuarioId: string, codigoConvite: string) {
  const sociedade = await prisma.sociedade.findUnique({
    where: { codigo_convite: codigoConvite },
  });

  if (!sociedade) {
    return { erro: 'NAO_ENCONTRADA' as const };
  }

  const jaSocio = await prisma.socioSociedade.findUnique({
    where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedade.id } },
  });

  if (jaSocio) {
    return { erro: 'JA_E_SOCIO' as const };
  }

  await prisma.socioSociedade.create({
    data: {
      usuario_id: usuarioId,
      sociedade_id: sociedade.id,
      percentual_lucro: 0,
      papel: PapelSocio.MEEIRO,
    },
  });

  return {
    sociedade: { id: sociedade.id, nome: sociedade.nome },
  };
}

export async function ehSocio(usuarioId: string, sociedadeId: string): Promise<boolean> {
  const vinculo = await prisma.socioSociedade.findUnique({
    where: { usuario_id_sociedade_id: { usuario_id: usuarioId, sociedade_id: sociedadeId } },
  });
  return vinculo !== null;
}

export async function listarSociedadesDoUsuario(usuarioId: string) {
  const vinculos = await prisma.socioSociedade.findMany({
    where: { usuario_id: usuarioId },
    include: { sociedade: true },
  });

  return vinculos.map((v) => ({
    id: v.sociedade.id,
    nome: v.sociedade.nome,
    codigo_convite: v.sociedade.codigo_convite,
    percentual_lucro: v.percentual_lucro,
    papel: v.papel,
  }));
}

export async function listarSocios(sociedadeId: string) {
  const vinculos = await prisma.socioSociedade.findMany({
    where: { sociedade_id: sociedadeId },
    include: { usuario: true },
  });

  return vinculos.map((v) => ({
    usuario_id: v.usuario_id,
    nome: v.usuario.nome,
    telefone: v.usuario.telefone,
    percentual_lucro: v.percentual_lucro,
    papel: v.papel,
  }));
}

interface SocioPercentualInput {
  usuario_id: string;
  percentual_lucro: number;
  papel: PapelSocio;
}

type AtualizarPercentuaisResultado =
  | { erro: 'SOCIOS_FALTANDO' }
  | { erro: 'SOMA_INVALIDA'; soma: number }
  | { socios: Awaited<ReturnType<typeof listarSocios>> };

export async function atualizarPercentuais(
  sociedadeId: string,
  entrada: SocioPercentualInput[]
): Promise<AtualizarPercentuaisResultado> {
  const socioAtuais = await prisma.socioSociedade.findMany({
    where: { sociedade_id: sociedadeId },
  });

  const idsAtuais = new Set(socioAtuais.map((s) => s.usuario_id));
  const idsEnviados = new Set(entrada.map((s) => s.usuario_id));

  const cobreTodos =
    idsAtuais.size === idsEnviados.size && [...idsAtuais].every((id) => idsEnviados.has(id));

  if (!cobreTodos) {
    return { erro: 'SOCIOS_FALTANDO' };
  }

  const soma = entrada.reduce((acc, s) => acc + s.percentual_lucro, 0);
  if (Math.abs(soma - 100) > TOLERANCIA_SOMA_PERCENTUAL) {
    return { erro: 'SOMA_INVALIDA', soma };
  }

  await prisma.$transaction(
    entrada.map((s) =>
      prisma.socioSociedade.update({
        where: { usuario_id_sociedade_id: { usuario_id: s.usuario_id, sociedade_id: sociedadeId } },
        data: { percentual_lucro: s.percentual_lucro, papel: s.papel },
      })
    )
  );

  return { socios: await listarSocios(sociedadeId) };
}
