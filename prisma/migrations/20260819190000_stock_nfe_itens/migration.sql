-- ESTOQUE FASE 0 item 3 (19/08) — itens, duplicatas e emitente da NF-e completa.
-- MÓDULO ISOLADO: SÓ CRIA. Zero ALTER/DROP, companyId/nfeId como valor (sem FK).

CREATE TABLE "stock_nfe_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nItem" INTEGER NOT NULL,
    "cProd" TEXT,
    "cEAN" TEXT,
    "xProd" TEXT NOT NULL,
    "ncm" TEXT,
    "cest" TEXT,
    "cfop" TEXT,
    "uCom" TEXT,
    "qCom" DOUBLE PRECISION,
    "vUnCom" DOUBLE PRECISION,
    "vProd" DOUBLE PRECISION,
    "uTrib" TEXT,
    "qTrib" DOUBLE PRECISION,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_nfe_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_nfe_dup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "nDup" TEXT,
    "dVenc" TIMESTAMP(3),
    "vDup" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_nfe_dup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_nfe_emit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "xNome" TEXT NOT NULL,
    "xFant" TEXT,
    "ie" TEXT,
    "uf" TEXT,
    "xMun" TEXT,
    "cMun" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_nfe_emit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_nfe_item_companyId_nfeId_idx" ON "stock_nfe_item"("companyId", "nfeId");
CREATE INDEX "stock_nfe_item_companyId_ncm_idx" ON "stock_nfe_item"("companyId", "ncm");
CREATE INDEX "stock_nfe_dup_companyId_nfeId_idx" ON "stock_nfe_dup"("companyId", "nfeId");
CREATE UNIQUE INDEX "stock_nfe_emit_nfeId_key" ON "stock_nfe_emit"("nfeId");
CREATE INDEX "stock_nfe_emit_companyId_idx" ON "stock_nfe_emit"("companyId");
