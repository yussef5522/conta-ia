-- 25/11/2026 — ACERTO DA FICHA TARDIA (mini-sprint "ficha que chegou depois").
-- 100% ADITIVA: 1 CREATE TABLE nova. Nenhuma tabela existente é tocada.
CREATE TABLE "stock_acerto_ficha_tardia" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "baixados" TEXT NOT NULL,
    "foraPorContagem" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_acerto_ficha_tardia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_acerto_ficha_tardia_companyId_importId_nomeSuitable_key" ON "stock_acerto_ficha_tardia"("companyId", "importId", "nomeSuitable");
CREATE INDEX "stock_acerto_ficha_tardia_companyId_dia_idx" ON "stock_acerto_ficha_tardia"("companyId", "dia");
