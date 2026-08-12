-- AlterTable
ALTER TABLE "despesas" ADD COLUMN     "idempotency_key" TEXT;

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "despesas_idempotency_key_key" ON "despesas"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_idempotency_key_key" ON "vendas"("idempotency_key");

