// Spec 28 — cria (ou atualiza a senha de) o login do dono no painel admin.
//
// Não existe tela de cadastro de admin de propósito (spec 18): a única conta é criada à mão,
// por este script. E-mail e senha vêm de variáveis de ambiente pra que a senha nunca fique
// escrita em arquivo versionado nem no histórico do git:
//
//   ADMIN_EMAIL="voce@exemplo.com" ADMIN_SENHA="uma-senha-forte" npx ts-node scripts/criar-admin.ts
//
// Roda contra o banco do DATABASE_URL do ambiente em que for executado (local por padrão,
// `backend/.env`). Pra criar em staging/produção, aponte DATABASE_URL pra aquele banco só
// nessa execução. O script imprime o host do banco antes de gravar, pra não haver dúvida
// de onde a conta foi criada. Idempotente: rodar de novo com o mesmo e-mail só troca a senha.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA;
  const nome = process.env.ADMIN_NOME?.trim() || 'Administrador';

  if (!email || !senha) {
    console.error('Defina ADMIN_EMAIL e ADMIN_SENHA no ambiente.');
    process.exit(1);
  }
  if (senha.length < 8) {
    console.error('A senha precisa ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`Banco: ${host}`);

  const senhaHash = await bcrypt.hash(senha, 10);
  const existente = await prisma.adminUsuario.findUnique({ where: { email } });

  if (existente) {
    await prisma.adminUsuario.update({ where: { email }, data: { senha_hash: senhaHash, nome } });
    console.log(`Admin ${email} já existia: senha atualizada.`);
  } else {
    await prisma.adminUsuario.create({ data: { email, nome, senha_hash: senhaHash } });
    console.log(`Admin ${email} criado.`);
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
