-- Sprint 5.0.2.u — Multi-statement staging (Xero/QuickBooks pattern).
-- User importa N OFX num batch; sistema detecta transferências cross-account
-- ANTES de criar Transactions; user revisa e confirma.

CREATE TABLE "import_stagings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "totalTransactions" INTEGER NOT NULL,
  "totalCreditsCents" INTEGER NOT NULL DEFAULT 0,
  "totalDebitsCents" INTEGER NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "import_stagings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_stagings_companyId_fileHash_key" ON "import_stagings"("companyId", "fileHash");
CREATE INDEX "import_stagings_companyId_batchId_idx" ON "import_stagings"("companyId", "batchId");
CREATE INDEX "import_stagings_companyId_status_idx" ON "import_stagings"("companyId", "status");

ALTER TABLE "import_stagings"
  ADD CONSTRAINT "import_stagings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_stagings"
  ADD CONSTRAINT "import_stagings_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staged_transactions" (
  "id" TEXT NOT NULL,
  "stagingId" TEXT NOT NULL,
  "fitId" TEXT,
  "effectedDate" TIMESTAMP(3) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false,
  "matchedStagedId" TEXT,
  "transferConfidence" DOUBLE PRECISION,
  "transferReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "staged_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staged_transactions_stagingId_idx" ON "staged_transactions"("stagingId");
CREATE INDEX "staged_transactions_matchedStagedId_idx" ON "staged_transactions"("matchedStagedId");

ALTER TABLE "staged_transactions"
  ADD CONSTRAINT "staged_transactions_stagingId_fkey"
  FOREIGN KEY ("stagingId") REFERENCES "import_stagings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
