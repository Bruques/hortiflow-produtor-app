-- CreateTable
CREATE TABLE "socios_safra" (
    "id" TEXT NOT NULL,
    "safra_id" TEXT NOT NULL,
    "socio_sociedade_id" TEXT NOT NULL,
    "percentual_lucro" DECIMAL(5,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "socios_safra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "socios_safra_safra_id_socio_sociedade_id_key" ON "socios_safra"("safra_id", "socio_sociedade_id");

-- AddForeignKey
ALTER TABLE "socios_safra" ADD CONSTRAINT "socios_safra_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios_safra" ADD CONSTRAINT "socios_safra_socio_sociedade_id_fkey" FOREIGN KEY ("socio_sociedade_id") REFERENCES "socio_sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Task 23 (docs/specs/23-socios-por-safra.md): backfill de dados. Sócios e percentuais
-- passam a ser por Safra, não por Sociedade — toda Safra já existente ganha os mesmos
-- sócios/percentuais que a sua Sociedade tinha no momento desta migração, preservando o
-- comportamento e os Acertos já fechados (nada muda pra quem já usa o app hoje).
INSERT INTO "socios_safra" ("id", "safra_id", "socio_sociedade_id", "percentual_lucro", "criado_em")
SELECT gen_random_uuid(), s."id", ss."id", ss."percentual_lucro", CURRENT_TIMESTAMP
FROM "safras" s
JOIN "socio_sociedades" ss ON ss."sociedade_id" = s."sociedade_id";
