-- ESTOQUE ↔ FINANCEIRO — PONTE 1. CREATE-only (a amarra fica do lado do estoque).
-- CAMADA 1: o UNIQUE torna IMPOSSÍVEL a mesma parcela virar duas contas a pagar —
-- idempotência por construção, não por checagem lembrada.
CREATE TABLE "stock_payable_link" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "suggestionId" TEXT,
    "nDup" TEXT,
    "chave" TEXT,
    "transactionId" TEXT NOT NULL,
    "supplierId" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "dVenc" TIMESTAMP(3) NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_payable_link_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_payable_link_origem" CHECK ("origem" IN ('NFE','ENTRADA_MANUAL')),
    CONSTRAINT "chk_payable_link_valor" CHECK ("valor" > 0)
);

CREATE UNIQUE INDEX "stock_payable_link_unica_parcela"
  ON "stock_payable_link"("companyId", "origem", "refId", "nDup");
CREATE INDEX "stock_payable_link_companyId_transactionId_idx"
  ON "stock_payable_link"("companyId", "transactionId");
