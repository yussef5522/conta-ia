-- ESTOQUE — ENTRADA MANUAL (compra sem nota). CREATE-only (isolamento).
-- CAMADA 1: quantidade > 0 e custo >= 0 (compra bonificada existe, custo 0 é válido);
-- valorTotal >= 0; parcela coerente (se geraPayable, precisa de vencimento E valor > 0)
-- → "gera parcela" sem vencimento é IMPOSSÍVEL por construção.
CREATE TABLE "stock_entrada_manual" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fornecedorNome" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "geraPayable" BOOLEAN NOT NULL DEFAULT false,
    "payableVenc" TIMESTAMP(3),
    "payableValor" DOUBLE PRECISION,
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_entrada_manual_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_entrada_manual_valor" CHECK ("valorTotal" >= 0),
    CONSTRAINT "chk_entrada_manual_payable" CHECK (
      "geraPayable" = false OR ("payableVenc" IS NOT NULL AND "payableValor" IS NOT NULL AND "payableValor" > 0)
    )
);

CREATE TABLE "stock_entrada_manual_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "custoUnitario" DOUBLE PRECISION NOT NULL,
    "custoTotal" DOUBLE PRECISION NOT NULL,
    "movementId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_entrada_manual_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_entrada_manual_item_qtd" CHECK ("quantidade" > 0),
    CONSTRAINT "chk_entrada_manual_item_custo" CHECK ("custoUnitario" >= 0)
);

CREATE INDEX "stock_entrada_manual_companyId_data_idx" ON "stock_entrada_manual"("companyId", "data");
CREATE INDEX "stock_entrada_manual_item_companyId_entradaId_idx" ON "stock_entrada_manual_item"("companyId", "entradaId");
