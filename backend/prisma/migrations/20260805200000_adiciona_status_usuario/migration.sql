-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'BLOQUEADO');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO';
