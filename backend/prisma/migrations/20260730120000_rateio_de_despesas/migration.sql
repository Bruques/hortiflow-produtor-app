-- CreateTable
CREATE TABLE "rateios_despesa" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "socio_sociedade_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "rateios_despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateios_regra" (
    "id" TEXT NOT NULL,
    "regra_id" TEXT NOT NULL,
    "socio_sociedade_id" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "rateios_regra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rateios_despesa_despesa_id_socio_sociedade_id_key" ON "rateios_despesa"("despesa_id", "socio_sociedade_id");

-- CreateIndex
CREATE UNIQUE INDEX "rateios_regra_regra_id_socio_sociedade_id_key" ON "rateios_regra"("regra_id", "socio_sociedade_id");

-- AddForeignKey
ALTER TABLE "rateios_despesa" ADD CONSTRAINT "rateios_despesa_despesa_id_fkey" FOREIGN KEY ("despesa_id") REFERENCES "despesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rateios_despesa" ADD CONSTRAINT "rateios_despesa_socio_sociedade_id_fkey" FOREIGN KEY ("socio_sociedade_id") REFERENCES "socio_sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rateios_regra" ADD CONSTRAINT "rateios_regra_regra_id_fkey" FOREIGN KEY ("regra_id") REFERENCES "regras_despesa_recorrente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rateios_regra" ADD CONSTRAINT "rateios_regra_socio_sociedade_id_fkey" FOREIGN KEY ("socio_sociedade_id") REFERENCES "socio_sociedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

