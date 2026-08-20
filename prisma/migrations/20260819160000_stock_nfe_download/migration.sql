-- ESTOQUE FASE 0 item 2 (19/08/2026) — download SEFAZ (NFeDistribuicaoDFe), só resumos.
-- MÓDULO ISOLADO: SÓ CRIA. Zero ALTER/DROP, companyId é valor (sem FK à companies).

-- CreateTable
CREATE TABLE "stock_sefaz_state" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ultNSU" TEXT NOT NULL DEFAULT '000000000000000',
    "maxNSU" TEXT NOT NULL DEFAULT '000000000000000',
    "dataCorte" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_sefaz_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_sefaz_log" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nsuInicial" TEXT NOT NULL,
    "nsuFinal" TEXT NOT NULL,
    "nDocs" INTEGER NOT NULL DEFAULT 0,
    "cStat" TEXT,
    "xMotivo" TEXT,
    "tempoMs" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_sefaz_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_nfe" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nsu" TEXT NOT NULL,
    "emitCnpj" TEXT,
    "emitNome" TEXT,
    "vNF" DOUBLE PRECISION,
    "dataEmissao" TIMESTAMP(3),
    "cSitNFe" TEXT,
    "tpNF" TEXT,
    "status" TEXT NOT NULL,
    "temXmlCompleto" BOOLEAN NOT NULL DEFAULT false,
    "schema" TEXT,
    "docXml" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_nfe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_sefaz_state_companyId_key" ON "stock_sefaz_state"("companyId");
CREATE INDEX "stock_sefaz_log_companyId_criadoEm_idx" ON "stock_sefaz_log"("companyId", "criadoEm");
CREATE INDEX "stock_nfe_companyId_status_idx" ON "stock_nfe"("companyId", "status");
CREATE INDEX "stock_nfe_companyId_dataEmissao_idx" ON "stock_nfe"("companyId", "dataEmissao");

-- CAMADA 1: idempotência — a mesma NF-e (chave) não entra 2× na mesma empresa.
CREATE UNIQUE INDEX "stock_nfe_companyId_chave_key" ON "stock_nfe"("companyId", "chave");
