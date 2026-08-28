-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PAGO', 'PENDENTE');

-- AlterTable
ALTER TABLE "despesas" ADD COLUMN     "data_pagamento" TIMESTAMP(3),
ADD COLUMN     "data_vencimento" TIMESTAMP(3),
ADD COLUMN     "status_pagamento" "StatusPagamento" NOT NULL DEFAULT 'PAGO';
