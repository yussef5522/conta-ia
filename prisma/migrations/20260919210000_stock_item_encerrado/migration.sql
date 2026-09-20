-- ⭐ ITEM ENCERRADO (19/09/2026) — CREATE-only, aditiva pura.
-- "Encerrado" é decisão FINAL e é diferente de "desativado" (que volta no toggle do
-- Catálogo). O registro é o que faz o histórico dizer "item encerrado em DD/MM" em vez
-- de simplesmente sumir — o passado continua legível (a régua da casa).
-- ROLLBACK: DROP TABLE "stock_item_encerrado";
CREATE TABLE "stock_item_encerrado" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_encerrado_pkey" PRIMARY KEY ("id"),
  -- ⛔ encerrar sem dizer por quê vira mistério em três meses
  CONSTRAINT "chk_item_encerrado_motivo" CHECK (length(trim("motivo")) > 0)
);

-- ⭐ encerrar duas vezes é IMPOSSÍVEL, não "checado"
CREATE UNIQUE INDEX "stock_item_encerrado_itemId_key" ON "stock_item_encerrado"("itemId");
CREATE INDEX "stock_item_encerrado_companyId_idx" ON "stock_item_encerrado"("companyId");
