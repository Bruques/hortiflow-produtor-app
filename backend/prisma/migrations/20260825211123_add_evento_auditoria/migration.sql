-- CreateTable
CREATE TABLE "eventos_auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "tipo" TEXT NOT NULL,
    "metadata" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_auditoria_usuario_id_idx" ON "eventos_auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "eventos_auditoria_tipo_idx" ON "eventos_auditoria"("tipo");

-- AddForeignKey
ALTER TABLE "eventos_auditoria" ADD CONSTRAINT "eventos_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

