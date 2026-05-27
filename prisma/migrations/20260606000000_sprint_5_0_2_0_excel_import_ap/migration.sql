-- Sprint 5.0.2.0 — Importador Excel de Contas a Pagar (CAIXAOS).
-- 3 modelos novos: Employee + ExcelImportBatch + StagedPayableRow
-- 1 coluna nova: transactions.employeeId

-- ─── EMPLOYEE ───
CREATE TABLE "employees" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'CLT',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_companyId_nome_key" ON "employees"("companyId", "nome");
CREATE INDEX "employees_companyId_ativo_idx" ON "employees"("companyId", "ativo");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── TRANSACTION.EMPLOYEEID ───
ALTER TABLE "transactions" ADD COLUMN "employeeId" TEXT;
CREATE INDEX "transactions_employeeId_idx" ON "transactions"("employeeId");
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── EXCEL IMPORT BATCH ───
CREATE TABLE "excel_import_batches" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "headerHash" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "totalCreditsCents" INTEGER NOT NULL DEFAULT 0,
  "totalDebitsCents" INTEGER NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "importedAt" TIMESTAMP(3),
  "columnMapping" TEXT,
  "detectConfidence" DOUBLE PRECISION,
  "detectCostUsd" DOUBLE PRECISION DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "excel_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "excel_import_batches_companyId_fileHash_key" ON "excel_import_batches"("companyId", "fileHash");
CREATE INDEX "excel_import_batches_companyId_status_idx" ON "excel_import_batches"("companyId", "status");
CREATE INDEX "excel_import_batches_companyId_headerHash_idx" ON "excel_import_batches"("companyId", "headerHash");

ALTER TABLE "excel_import_batches"
  ADD CONSTRAINT "excel_import_batches_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── STAGED PAYABLE ROW ───
CREATE TABLE "staged_payable_rows" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,

  "rawFavorecido" TEXT,
  "rawBeneficiario" TEXT,
  "rawDescricao" TEXT,
  "rawCentroCusto" TEXT,
  "rawLancamento" TEXT,
  "rawCompetencia" TEXT,
  "rawVencimento" TEXT,
  "rawPagamento" TEXT,
  "rawValor" DOUBLE PRECISION,
  "rawValorBaixa" DOUBLE PRECISION,
  "rawNota" TEXT,
  "rawStatus" TEXT,

  "valor" DOUBLE PRECISION NOT NULL,
  "vencimento" TIMESTAMP(3),
  "pagamento" TIMESTAMP(3),
  "competencia" TIMESTAMP(3),
  "paymentStatus" TEXT NOT NULL,

  "favorecidoType" TEXT,
  "matchedSupplierId" TEXT,
  "matchedEmployeeId" TEXT,
  "favorecidoConfidence" DOUBLE PRECISION,

  "matchedCategoryId" TEXT,
  "proposedCategoryName" TEXT,
  "categoryConfidence" DOUBLE PRECISION,

  "dedupHash" TEXT,
  "duplicateOf" TEXT,

  "userDecision" TEXT NOT NULL DEFAULT 'INCLUDE',
  "validationError" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staged_payable_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staged_payable_rows_batchId_userDecision_idx" ON "staged_payable_rows"("batchId", "userDecision");
CREATE INDEX "staged_payable_rows_batchId_paymentStatus_idx" ON "staged_payable_rows"("batchId", "paymentStatus");

ALTER TABLE "staged_payable_rows"
  ADD CONSTRAINT "staged_payable_rows_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "excel_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
