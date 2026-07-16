/**
 * Cria uma sociedade de demonstração com dados simulados (2 sócios, 1 safra em
 * andamento, despesas e vendas espalhadas por vários dias) para permitir que
 * alguém teste o app sem precisar cadastrar nada manualmente.
 *
 * Uso: rodar com DATABASE_URL apontando para o banco de destino, ex:
 *   DATABASE_URL="postgresql://...neon..." npx ts-node prisma/seed-demo.ts
 *
 * Idempotente: se a sociedade "Sítio Boa Esperança (Demo)" já existir, apaga
 * e recria do zero antes de popular, para poder rodar de novo sem duplicar.
 */
import { PrismaClient, PapelSocio, StatusSafra, TipoDespesa } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const NOME_SOCIEDADE = 'Sítio Boa Esperança (Demo)';

function gerarCodigoConvite(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function gerarCodigoConviteUnico(): Promise<string> {
  let codigo = gerarCodigoConvite();
  while (await prisma.sociedade.findUnique({ where: { codigo_convite: codigo } })) {
    codigo = gerarCodigoConvite();
  }
  return codigo;
}

function diasAtras(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function limparSociedadeAnterior() {
  const anterior = await prisma.sociedade.findFirst({ where: { nome: NOME_SOCIEDADE } });
  if (!anterior) return;

  const safras = await prisma.safra.findMany({ where: { sociedade_id: anterior.id } });
  const safraIds = safras.map((s) => s.id);

  await prisma.despesa.deleteMany({ where: { safra_id: { in: safraIds } } });
  await prisma.venda.deleteMany({ where: { safra_id: { in: safraIds } } });
  await prisma.despesaPessoal.deleteMany({ where: { safra_id: { in: safraIds } } });
  await prisma.aporteTrabalho.deleteMany({ where: { safra_id: { in: safraIds } } });
  await prisma.regraDespesaRecorrente.deleteMany({ where: { sociedade_id: anterior.id } });
  await prisma.safra.deleteMany({ where: { sociedade_id: anterior.id } });
  await prisma.socioSociedade.deleteMany({ where: { sociedade_id: anterior.id } });
  await prisma.sociedade.delete({ where: { id: anterior.id } });

  console.log('Sociedade demo anterior removida, recriando do zero...');
}

async function main() {
  await limparSociedadeAnterior();

  const senhaHash = await bcrypt.hash('morango2026', 10);

  // Nomes fictícios — não representam pessoas reais.
  const financiador = await prisma.usuario.upsert({
    where: { telefone: '31999990001' },
    update: { senha_hash: senhaHash },
    create: {
      nome: 'Eduardo Ramos',
      telefone: '31999990001',
      senha_hash: senhaHash,
    },
  });

  const meeiro = await prisma.usuario.upsert({
    where: { telefone: '31999990002' },
    update: { senha_hash: senhaHash },
    create: {
      nome: 'Antônio Ferreira',
      telefone: '31999990002',
      senha_hash: senhaHash,
    },
  });

  const codigoConvite = await gerarCodigoConviteUnico();

  const sociedade = await prisma.sociedade.create({
    data: {
      nome: NOME_SOCIEDADE,
      codigo_convite: codigoConvite,
    },
  });

  await prisma.socioSociedade.create({
    data: {
      usuario_id: financiador.id,
      sociedade_id: sociedade.id,
      percentual_lucro: 60,
      papel: PapelSocio.FINANCIADOR,
    },
  });

  await prisma.socioSociedade.create({
    data: {
      usuario_id: meeiro.id,
      sociedade_id: sociedade.id,
      percentual_lucro: 40,
      papel: PapelSocio.MEEIRO,
    },
  });

  const safra = await prisma.safra.create({
    data: {
      sociedade_id: sociedade.id,
      nome: 'Safra 2026',
      status: StatusSafra.EM_ANDAMENTO,
      data_inicio: diasAtras(46),
    },
  });

  const despesas: { dias: number; tipo: TipoDespesa; valor: number; socio: string }[] = [
    { dias: 41, tipo: TipoDespesa.TERRA, valor: 3000, socio: financiador.id },
    { dias: 36, tipo: TipoDespesa.MUDAS, valor: 4500, socio: financiador.id },
    { dias: 31, tipo: TipoDespesa.ADUBO, valor: 1200, socio: financiador.id },
    { dias: 26, tipo: TipoDespesa.DEFENSIVOS, valor: 800, socio: meeiro.id },
    { dias: 21, tipo: TipoDespesa.MAO_DE_OBRA, valor: 1500, socio: meeiro.id },
    { dias: 15, tipo: TipoDespesa.EMBALAGEM, valor: 600, socio: financiador.id },
    { dias: 11, tipo: TipoDespesa.TRANSPORTE, valor: 350, socio: meeiro.id },
    { dias: 8, tipo: TipoDespesa.ADUBO, valor: 900, socio: financiador.id },
    { dias: 6, tipo: TipoDespesa.MAO_DE_OBRA, valor: 1100, socio: meeiro.id },
    { dias: 3, tipo: TipoDespesa.DEFENSIVOS, valor: 500, socio: financiador.id },
    { dias: 2, tipo: TipoDespesa.TRANSPORTE, valor: 280, socio: meeiro.id },
    { dias: 1, tipo: TipoDespesa.EMBALAGEM, valor: 420, socio: financiador.id },
    { dias: 0, tipo: TipoDespesa.OUTRO, valor: 150, socio: meeiro.id },
  ];

  for (const d of despesas) {
    await prisma.despesa.create({
      data: {
        safra_id: safra.id,
        socio_id: d.socio,
        tipo: d.tipo,
        valor: d.valor,
        data: diasAtras(d.dias),
      },
    });
  }

  const vendas: { dias: number; quantidade: number; preco: number; comprador: string }[] = [
    { dias: 26, quantidade: 200, preco: 8.5, comprador: 'Ceasa Poços de Caldas' },
    { dias: 18, quantidade: 350, preco: 9.0, comprador: 'Ceasa Poços de Caldas' },
    { dias: 11, quantidade: 300, preco: 8.8, comprador: 'Sacolão Bom Repouso' },
    { dias: 6, quantidade: 280, preco: 9.2, comprador: 'Ceasa Poços de Caldas' },
    { dias: 3, quantidade: 150, preco: 9.5, comprador: 'Sacolão Bom Repouso' },
    { dias: 1, quantidade: 120, preco: 9.3, comprador: 'Feira Livre' },
    { dias: 0, quantidade: 90, preco: 9.4, comprador: 'Feira Livre' },
  ];

  for (const v of vendas) {
    await prisma.venda.create({
      data: {
        safra_id: safra.id,
        data: diasAtras(v.dias),
        quantidade: v.quantidade,
        preco: v.preco,
        total: v.quantidade * v.preco,
        comprador: v.comprador,
      },
    });
  }

  console.log('Sociedade demo criada com sucesso:');
  console.log({
    sociedade: sociedade.nome,
    codigo_convite: codigoConvite,
    financiador: { nome: financiador.nome, telefone: financiador.telefone, percentual: 60 },
    meeiro: { nome: meeiro.nome, telefone: meeiro.telefone, percentual: 40 },
    senha_ambos: 'morango2026',
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
