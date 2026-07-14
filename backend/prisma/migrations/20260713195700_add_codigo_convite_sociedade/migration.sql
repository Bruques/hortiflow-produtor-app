-- AlterTable
ALTER TABLE "sociedades" ADD COLUMN     "codigo_convite" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sociedades_codigo_convite_key" ON "sociedades"("codigo_convite");
