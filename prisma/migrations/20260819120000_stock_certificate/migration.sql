-- ESTOQUE FASE 0 item 1 (19/08/2026) — certificado A1 cifrado + relatório do juiz
-- do estoque. MÓDULO ISOLADO: SÓ CRIA. Zero ALTER/DROP, zero referência a tabela
-- fechada (companyId é valor, não FK à companies). Aditiva pura, risco zero.

-- CreateTable
CREATE TABLE "stock_certificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pfxCipher" TEXT NOT NULL,
    "senhaCipher" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "validadeDe" TIMESTAMP(3) NOT NULL,
    "validadeAte" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimoUsoEm" TIMESTAMP(3),
    CONSTRAINT "stock_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_judge_report" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,
    "stockIssues" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "stock_judge_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_certificate_companyId_idx" ON "stock_certificate"("companyId");

-- CreateIndex
CREATE INDEX "stock_judge_report_runAt_idx" ON "stock_judge_report"("runAt");

-- CAMADA 1 (por construção): "um certificado ATIVO por company" — índice único
-- PARCIAL. Funciona em Postgres (prod) E SQLite ≥3.8 (dev). Impossível ter 2 ativos.
CREATE UNIQUE INDEX "stock_certificate_one_active_per_company"
  ON "stock_certificate"("companyId") WHERE "status" = 'ATIVO';
