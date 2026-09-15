-- CreateEnum
CREATE TYPE "CicloAssinatura" AS ENUM ('MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "FaixaMeeiros" AS ENUM ('UM_A_TRES', 'QUATRO_A_DEZ', 'DEZ_OU_MAIS');

-- CreateEnum
CREATE TYPE "LocalizacaoProducao" AS ENUM ('BOM_REPOUSO', 'OUTRA_CIDADE');

-- AlterEnum
ALTER TYPE "MetodoPagamento" ADD VALUE 'GATEWAY_MP_CARTAO';
ALTER TYPE "MetodoPagamento" ADD VALUE 'GATEWAY_MP_PIX';

-- AlterTable
ALTER TABLE "assinaturas" ADD COLUMN     "ciclo" "CicloAssinatura",
ADD COLUMN     "faixa_meeiros" "FaixaMeeiros",
ADD COLUMN     "localizacao_producao" "LocalizacaoProducao",
ADD COLUMN     "mp_preapproval_id" TEXT,
ADD COLUMN     "quantidade_pes_morango" INTEGER;

-- AlterTable
ALTER TABLE "pagamentos" ADD COLUMN     "mp_payment_id" TEXT;

-- AlterTable: novas colunas de Plano. `valor_anual` entra nullable porque a tabela já
-- tem 3 linhas — o UPDATE logo abaixo (spec 25) preenche todos os planos existentes
-- (renomeando e reprecificando pra nova tabela) antes do NOT NULL final.
ALTER TABLE "planos" ADD COLUMN     "despesas_pessoais" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "implantacao_assistida_mensal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "limite_importacao_ia_mes" INTEGER,
ADD COLUMN     "suporte_prioritario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valor_anual" DECIMAL(10,2);

-- Spec 25 — renomeia e reprecifica os 3 planos existentes (spec 18) pra nova tabela,
-- agora orientada por quantidade de meeiros em vez de pés de morango. Atualiza por
-- `nome` (não por id, que é gerado aleatoriamente na seed original) — cada UPDATE só
-- roda se a linha ainda tiver o nome antigo, então rodar a migration de novo (idempotência
-- do ambiente de dev) não sobrescreve um nome já trocado manualmente pelo admin.
UPDATE "planos" SET
  "nome" = 'Essencial',
  "valor_mensal" = 49.90,
  "valor_anual" = 499.00,
  "limite_safras_ativas" = 3,
  "limite_importacao_ia_mes" = 40,
  "despesas_pessoais" = false,
  "suporte_prioritario" = false,
  "implantacao_assistida_mensal" = false
WHERE "nome" = 'Plano 1';

UPDATE "planos" SET
  "nome" = 'Profissional',
  "valor_mensal" = 89.90,
  "valor_anual" = 899.00,
  "limite_safras_ativas" = 10,
  "limite_importacao_ia_mes" = 100,
  "despesas_pessoais" = true,
  "suporte_prioritario" = true,
  "implantacao_assistida_mensal" = true
WHERE "nome" = 'Plano 2';

UPDATE "planos" SET
  "nome" = 'Gestão',
  "valor_mensal" = 129.90,
  "valor_anual" = 1299.00,
  "limite_safras_ativas" = NULL,
  "limite_importacao_ia_mes" = 150,
  "despesas_pessoais" = true,
  "suporte_prioritario" = true,
  "implantacao_assistida_mensal" = true
WHERE "nome" = 'Plano 3';

-- Qualquer plano fora dos 3 nomes esperados (não deveria existir) recebe um valor_anual
-- de segurança igual a 10x o mensal, só pra permitir o NOT NULL final sem quebrar.
UPDATE "planos" SET "valor_anual" = "valor_mensal" * 10 WHERE "valor_anual" IS NULL;

ALTER TABLE "planos" ALTER COLUMN "valor_anual" SET NOT NULL;
