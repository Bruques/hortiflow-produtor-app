-- DropForeignKey
ALTER TABLE "acerto_socios" DROP CONSTRAINT "acerto_socios_socio_id_fkey";

-- DropForeignKey
ALTER TABLE "socio_sociedades" DROP CONSTRAINT "socio_sociedades_usuario_id_fkey";

-- AlterTable
ALTER TABLE "socio_sociedades" ADD COLUMN     "nome" TEXT,
ALTER COLUMN "usuario_id" DROP NOT NULL;

-- Backfill: acerto_socios.socio_id guardava usuarios.id; passa a guardar socio_sociedades.id.
-- Junta pelo usuario_id + sociedade_id da safra do acerto pra achar o vínculo correspondente.
UPDATE "acerto_socios" AS acs
SET "socio_id" = ss."id"
FROM "socio_sociedades" ss, "acertos" a, "safras" sf
WHERE a."id" = acs."acerto_id"
  AND sf."id" = a."safra_id"
  AND ss."usuario_id" = acs."socio_id"
  AND ss."sociedade_id" = sf."sociedade_id";

-- AddForeignKey
ALTER TABLE "socio_sociedades" ADD CONSTRAINT "socio_sociedades_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto_socios" ADD CONSTRAINT "acerto_socios_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio_sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
