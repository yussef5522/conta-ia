-- ESTOQUE FASE 1 item 4 — "deixar pra depois" (adia nota da fila, silencia o badge).
-- CREATE-only (isolamento: nenhuma tabela existente é tocada; só stock_).
CREATE TABLE "stock_nfe_adiada" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "motivo" TEXT,
    "adiadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adiadaPorId" TEXT,

    CONSTRAINT "stock_nfe_adiada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_nfe_adiada_companyId_idx" ON "stock_nfe_adiada"("companyId");
CREATE UNIQUE INDEX "stock_nfe_adiada_companyId_nfeId_key" ON "stock_nfe_adiada"("companyId", "nfeId");
