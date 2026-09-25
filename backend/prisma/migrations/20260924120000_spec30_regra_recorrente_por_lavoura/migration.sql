-- Spec 30 — regra recorrente por lavoura. Coluna nullable: regras existentes ficam com
-- safra_id NULL (globais, valem em todas as lavouras da sociedade), nenhuma linha é alterada.
ALTER TABLE "regras_despesa_recorrente" ADD COLUMN "safra_id" TEXT;

CREATE INDEX "regras_despesa_recorrente_safra_id_idx" ON "regras_despesa_recorrente"("safra_id");

ALTER TABLE "regras_despesa_recorrente" ADD CONSTRAINT "regras_despesa_recorrente_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
