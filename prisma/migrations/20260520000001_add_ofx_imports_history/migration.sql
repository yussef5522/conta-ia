-- Onda 2 Sprint 2.3 — histórico de imports OFX + Transaction.importId.

-- ============================================================
-- 1. Transaction.importId (NULL pra imports antigos / manuais)
-- ============================================================
ALTER TABLE "transactions"
  ADD COLUMN "importId" TEXT;

CREATE INDEX "transactions_importId_idx" ON "transactions"("importId");

-- ============================================================
-- 2. CREATE TABLE ofx_imports
-- ============================================================
CREATE TABLE "ofx_imports" (
  "id"                TEXT NOT NULL,
  "bankAccountId"     TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'PROCESSING',
  "fileName"          TEXT NOT NULL,
  "fileSize"          INTEGER NOT NULL DEFAULT 0,
  "totalTransactions" INTEGER NOT NULL DEFAULT 0,
  "newTransactions"   INTEGER NOT NULL DEFAULT 0,
  "duplicates"        INTEGER NOT NULL DEFAULT 0,
  "autoClassified"    INTEGER NOT NULL DEFAULT 0,
  "periodStart"       TIMESTAMP(3),
  "periodEnd"         TIMESTAMP(3),
  "ipAddress"         TEXT,
  "userAgent"         TEXT,
  "errorMessage"      TEXT,
  "revertedAt"        TIMESTAMP(3),
  "revertedById"      TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ofx_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ofx_imports_bankAccountId_createdAt_idx"
  ON "ofx_imports"("bankAccountId", "createdAt");
CREATE INDEX "ofx_imports_userId_idx" ON "ofx_imports"("userId");
CREATE INDEX "ofx_imports_status_idx" ON "ofx_imports"("status");

ALTER TABLE "ofx_imports"
  ADD CONSTRAINT "ofx_imports_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ofx_imports"
  ADD CONSTRAINT "ofx_imports_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ofx_imports"
  ADD CONSTRAINT "ofx_imports_revertedById_fkey"
  FOREIGN KEY ("revertedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. FK Transaction.importId → ofx_imports (depois da CREATE TABLE)
-- ============================================================
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "ofx_imports"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
