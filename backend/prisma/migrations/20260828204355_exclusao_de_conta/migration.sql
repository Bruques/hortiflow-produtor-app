-- AlterEnum
ALTER TYPE "StatusUsuario" ADD VALUE 'EXCLUIDO';

-- DropForeignKey
ALTER TABLE "assinaturas" DROP CONSTRAINT "assinaturas_usuario_id_fkey";

-- AlterTable
ALTER TABLE "assinaturas" ALTER COLUMN "usuario_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
