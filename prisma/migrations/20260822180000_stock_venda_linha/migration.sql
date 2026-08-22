-- ESTOQUE FASE 3 — linhas do import de vendas (pendentes + reprocessar). CREATE-only.
CREATE TABLE "stock_venda_linha" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "mapeadoNoImport" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_venda_linha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_venda_linha_companyId_importId_idx" ON "stock_venda_linha"("companyId", "importId");
CREATE INDEX "stock_venda_linha_companyId_data_idx" ON "stock_venda_linha"("companyId", "data");
