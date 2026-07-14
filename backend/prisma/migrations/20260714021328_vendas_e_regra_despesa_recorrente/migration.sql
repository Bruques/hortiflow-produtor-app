-- CreateEnum
CREATE TYPE "TipoGatilhoRegra" AS ENUM ('POR_VENDA', 'POR_PERIODO');

-- AlterTable
ALTER TABLE "despesas" ADD COLUMN     "regra_origem_id" TEXT;

-- CreateTable
CREATE TABLE "regras_despesa_recorrente" (
    "id" TEXT NOT NULL,
    "sociedade_id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "criado_por" TEXT NOT NULL,
    "tipo_gatilho" "TipoGatilhoRegra" NOT NULL,
    "tipo_despesa" "TipoDespesa" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_despesa_recorrente_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_regra_origem_id_fkey" FOREIGN KEY ("regra_origem_id") REFERENCES "regras_despesa_recorrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_despesa_recorrente" ADD CONSTRAINT "regras_despesa_recorrente_sociedade_id_fkey" FOREIGN KEY ("sociedade_id") REFERENCES "sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_despesa_recorrente" ADD CONSTRAINT "regras_despesa_recorrente_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_despesa_recorrente" ADD CONSTRAINT "regras_despesa_recorrente_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
