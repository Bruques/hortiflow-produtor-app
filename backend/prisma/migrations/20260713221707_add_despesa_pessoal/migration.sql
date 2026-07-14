-- CreateTable
CREATE TABLE "despesas_pessoais" (
    "id" TEXT NOT NULL,
    "safra_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoDespesa" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "despesas_pessoais_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "despesas_pessoais" ADD CONSTRAINT "despesas_pessoais_safra_id_fkey" FOREIGN KEY ("safra_id") REFERENCES "safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesas_pessoais" ADD CONSTRAINT "despesas_pessoais_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

