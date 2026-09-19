-- ⭐ O LOTE ESTORNADO (19/09/2026) — CREATE-only, aditiva pura, zero ALTER.
-- O isolamento do módulo proíbe tocar tabela existente; e a separação é honesta:
-- a conclusão é o FATO, o estorno dela é outro fato (autor, data, motivo).
-- ROLLBACK: DROP TABLE "stock_conclusao_estornada";
CREATE TABLE "stock_conclusao_estornada" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "conclusaoId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "estornoMovimentoId" TEXT,
  "relancamentoMovimentoId" TEXT,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_conclusao_estornada_pkey" PRIMARY KEY ("id"),
  -- ⛔ motivo vazio não explica nada: estorno sem porquê vira mistério em três meses
  CONSTRAINT "chk_conclusao_estornada_motivo" CHECK (length(trim("motivo")) > 0)
);

-- ⭐ estornar duas vezes é IMPOSSÍVEL, não "checado"
CREATE UNIQUE INDEX "stock_conclusao_estornada_conclusaoId_key" ON "stock_conclusao_estornada"("conclusaoId");
CREATE INDEX "stock_conclusao_estornada_companyId_idx" ON "stock_conclusao_estornada"("companyId");
