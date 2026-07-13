-- CreateEnum
CREATE TYPE "PapelSocio" AS ENUM ('FINANCIADOR', 'MEEIRO', 'MISTO');

-- CreateEnum
CREATE TYPE "StatusSafra" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TipoDespesa" AS ENUM ('TERRA', 'MUDAS', 'ADUBO', 'DEFENSIVOS', 'MAO_DE_OBRA', 'EMBALAGEM', 'TRANSPORTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoAcerto" AS ENUM ('PARCIAL', 'FINAL');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sociedades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sociedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socio_sociedades" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "sociedade_id" TEXT NOT NULL,
    "percentual_lucro" DECIMAL(5,2) NOT NULL,
    "papel" "PapelSocio" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "socio_sociedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safras" (
    "id" TEXT NOT NULL,
    "sociedade_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusSafra" NOT NULL DEFAULT 'PLANEJADA',
    "data_inicio" TIMESTAMP(3),
    "data_fim" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despesas" (
    "id" TEXT NOT NULL,
    "safra_id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "tipo" "TipoDespesa" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "foto_comprovante" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aportes_trabalho" (
    "id" TEXT NOT NULL,
    "safra_id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "horas" DECIMAL(5,2) NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aportes_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "safra_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "comprador" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acertos" (
    "id" TEXT NOT NULL,
    "safra_id" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoAcerto" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acertos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acerto_socios" (
    "id" TEXT NOT NULL,
    "acerto_id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "despesas_bancadas" DECIMAL(10,2) NOT NULL,
    "percentual_aplicado" DECIMAL(5,2) NOT NULL,
    "valor_lucro" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "acerto_socios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_telefone_key" ON "usuarios"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "socio_sociedades_usuario_id_sociedade_id_key" ON "socio_sociedades"("usuario_id", "sociedade_id");

-- AddForeignKey
ALTER TABLE "socio_sociedades" ADD CONSTRAINT "socio_sociedades_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socio_sociedades" ADD CONSTRAINT "socio_sociedades_sociedade_id_fkey" FOREIGN KEY ("sociedade_id") REFERENCES "sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safras" ADD CONSTRAINT "safras_sociedade_id_fkey" FOREIGN KEY ("sociedade_id") REFERENCES "sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aportes_trabalho" ADD CONSTRAINT "aportes_trabalho_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aportes_trabalho" ADD CONSTRAINT "aportes_trabalho_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acertos" ADD CONSTRAINT "acertos_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto_socios" ADD CONSTRAINT "acerto_socios_acerto_id_fkey" FOREIGN KEY ("acerto_id") REFERENCES "acertos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto_socios" ADD CONSTRAINT "acerto_socios_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
