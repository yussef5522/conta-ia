-- ⭐ A CONTA AMARRADA FOI REMOVIDA NO FINANCEIRO (20/09/2026) — CREATE-only, aditiva pura.
-- Fecha o F2 na origem: o DELETE de conta avisa o estoque, e a amarra sai do alarme
-- por ter EXPLICAÇÃO — nunca por a evidência ter sumido (apagar a amarra faria a mesma
-- nota ser reenviada na próxima conferência, criando a conta duplicada).
-- ROLLBACK: DROP TABLE "stock_conta_removida";
CREATE TABLE "stock_conta_removida" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payableLinkId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "removidaPorId" TEXT,
  "removidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_conta_removida_pkey" PRIMARY KEY ("id")
);

-- ⭐ uma explicação por amarra — avisar 2× é impossível, não "checado"
CREATE UNIQUE INDEX "stock_conta_removida_payableLinkId_key" ON "stock_conta_removida"("payableLinkId");
CREATE INDEX "stock_conta_removida_companyId_idx" ON "stock_conta_removida"("companyId");
