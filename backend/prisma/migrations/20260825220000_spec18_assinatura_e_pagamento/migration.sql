-- Spec 18 — assinatura e pagamento

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('TRIAL', 'ATIVA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('GATEWAY_ASAAS', 'MANUAL_PIX', 'MANUAL_DINHEIRO');

-- CreateTable: login do painel admin, sem nenhuma relação com "usuarios" (produtores) —
-- conta criada manualmente pelo desenvolvedor, sem tela de cadastro.
CREATE TABLE "admin_usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_usuarios_email_key" ON "admin_usuarios"("email");

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor_mensal" DECIMAL(10,2) NOT NULL,
    "limite_safras_ativas" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "plano_id" TEXT,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'TRIAL',
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim_acesso" TIMESTAMP(3) NOT NULL,
    "limite_safras_ativas_override" INTEGER,
    "asaas_customer_id" TEXT,
    "asaas_subscription_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "assinatura_id" TEXT NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fim" TIMESTAMP(3) NOT NULL,
    "asaas_payment_id" TEXT,
    "registrado_por_admin_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_usuario_id_key" ON "assinaturas"("usuario_id");

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_registrado_por_admin_id_fkey" FOREIGN KEY ("registrado_por_admin_id") REFERENCES "admin_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed dos 3 planos (spec 18) — valor/limite editáveis depois via painel admin,
-- essas linhas só existem pra garantir que o catálogo já nasce populado em
-- qualquer ambiente (dev/staging/produção) assim que a migration roda.
INSERT INTO "planos" ("id", "nome", "valor_mensal", "limite_safras_ativas", "atualizado_em") VALUES
    (gen_random_uuid()::text, 'Plano 1', 47.98, 1, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Plano 2', 87.98, 3, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Plano 3', 156.98, NULL, CURRENT_TIMESTAMP);

-- Backfill de Assinatura para usuários já existentes antes desta feature.
-- Data de acesso liberada por 365 dias e status ATIVA (não TRIAL) — decisão
-- operacional para não bloquear ninguém que já usa o app em produção; o
-- desenvolvedor atribui o plano correto e ajusta a data pelo painel admin
-- quando fizer sentido para cada um.
INSERT INTO "assinaturas" ("id", "usuario_id", "status", "data_inicio", "data_fim_acesso", "atualizado_em")
SELECT gen_random_uuid()::text, "id", 'ATIVA', "criado_em", CURRENT_TIMESTAMP + INTERVAL '365 days', CURRENT_TIMESTAMP
FROM "usuarios";

-- AlterTable: novo campo de titular em Sociedade, adicionado como nullable
-- primeiro para permitir o backfill abaixo (sociedades já existentes não têm
-- esse dado).
ALTER TABLE "sociedades" ADD COLUMN "criado_por_usuario_id" TEXT;

-- Backfill: titular = o sócio com conta (usuario_id não nulo) mais antigo da
-- sociedade, priorizando quem tem papel FINANCIADOR ou MISTO sobre MEEIRO —
-- é a aproximação mais fiel de "quem criou a sociedade" possível com os dados
-- disponíveis hoje (a coluna não existia até agora).
UPDATE "sociedades" s
SET "criado_por_usuario_id" = sub.usuario_id
FROM (
    SELECT DISTINCT ON (sociedade_id) sociedade_id, usuario_id
    FROM "socio_sociedades"
    WHERE usuario_id IS NOT NULL
    ORDER BY sociedade_id,
        CASE papel WHEN 'FINANCIADOR' THEN 0 WHEN 'MISTO' THEN 0 ELSE 1 END,
        criado_em ASC
) sub
WHERE s."id" = sub.sociedade_id;

-- AlterTable: agora que todo registro está preenchido, trava a coluna
ALTER TABLE "sociedades" ALTER COLUMN "criado_por_usuario_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "sociedades" ADD CONSTRAINT "sociedades_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
