-- ESTOQUE FASE 3 — vendas: mapa que aprende (nome Suitable → ficha|revenda) + import diário.
-- CREATE-only (isolamento: nenhuma tabela existente é tocada; só stock_).

CREATE TABLE "stock_venda_produto_map" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "fichaId" TEXT,
    "itemId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_venda_produto_map_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_venda_map_alvo" CHECK ("alvoTipo" IN ('FICHA','REVENDA'))
);
CREATE INDEX "stock_venda_produto_map_companyId_idx" ON "stock_venda_produto_map"("companyId");
CREATE UNIQUE INDEX "stock_venda_produto_map_companyId_nomeSuitable_key" ON "stock_venda_produto_map"("companyId", "nomeSuitable");

CREATE TABLE "stock_venda_import" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "totalLinhas" INTEGER NOT NULL,
    "totalUnidades" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_venda_import_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_venda_import_companyId_idx" ON "stock_venda_import"("companyId");
CREATE UNIQUE INDEX "stock_venda_import_companyId_data_key" ON "stock_venda_import"("companyId", "data");
