-- CreateTable
CREATE TABLE "aceites_termos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "versao_termos" TEXT NOT NULL,
    "versao_privacidade" TEXT NOT NULL,
    "aceito_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceites_termos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aceites_termos_usuario_id_aceito_em_idx" ON "aceites_termos"("usuario_id", "aceito_em");

-- AddForeignKey
ALTER TABLE "aceites_termos" ADD CONSTRAINT "aceites_termos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
