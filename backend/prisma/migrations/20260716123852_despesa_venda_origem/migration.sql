-- AlterTable
ALTER TABLE "despesas" ADD COLUMN     "venda_origem_id" TEXT;

-- AddForeignKey
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_venda_origem_id_fkey" FOREIGN KEY ("venda_origem_id") REFERENCES "vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
