-- CreateTable
CREATE TABLE "unidades_venda" (
    "id" TEXT NOT NULL,
    "sociedade_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_venda_sociedade_id_nome_key" ON "unidades_venda"("sociedade_id", "nome");

-- AddForeignKey
ALTER TABLE "unidades_venda" ADD CONSTRAINT "unidades_venda_sociedade_id_fkey" FOREIGN KEY ("sociedade_id") REFERENCES "sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: cria unidade "Caixa" para cada sociedade já existente
INSERT INTO "unidades_venda" ("id", "sociedade_id", "nome", "ativo")
SELECT md5(random()::text || clock_timestamp()::text)::uuid, "id", 'Caixa', true
FROM "sociedades";

-- AlterTable: vendas ganha unidade_id (nullable até popular os dados existentes)
ALTER TABLE "vendas" ADD COLUMN "unidade_id" TEXT;

-- DataMigration: toda Venda existente passa a apontar pra unidade "Caixa" da sua sociedade
UPDATE "vendas" v
SET "unidade_id" = uv."id"
FROM "safras" s
JOIN "unidades_venda" uv ON uv."sociedade_id" = s."sociedade_id" AND uv."nome" = 'Caixa'
WHERE v."safra_id" = s."id";

ALTER TABLE "vendas" ALTER COLUMN "unidade_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades_venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: regras_despesa_recorrente ganha unidade_id (nullable, POR_PERIODO nunca terá unidade)
ALTER TABLE "regras_despesa_recorrente" ADD COLUMN "unidade_id" TEXT;

-- DataMigration: regras POR_VENDA existentes passam a apontar pra unidade "Caixa" da sua sociedade
UPDATE "regras_despesa_recorrente" r
SET "unidade_id" = uv."id"
FROM "unidades_venda" uv
WHERE r."sociedade_id" = uv."sociedade_id" AND uv."nome" = 'Caixa' AND r."tipo_gatilho" = 'POR_VENDA';

-- AddForeignKey
ALTER TABLE "regras_despesa_recorrente" ADD CONSTRAINT "regras_despesa_recorrente_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades_venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
