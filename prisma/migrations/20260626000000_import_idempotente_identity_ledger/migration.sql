-- Sprint Import Idempotente (18/06/2026) — identidade canônica + seen-ledger
-- + file hash + source no batch. PURAMENTE ADITIVA:
--   - 2 colunas nullable em transactions (fitidKey + contentHash)
--   - 2 colunas em ofx_imports (fileHash nullable + source com default)
--   - 1 tabela nova imported_identities (FKs Cascade/SetNull)
--   - índices novos pros gates
-- ZERO ALTER em dados reais (nenhum DROP/RENAME/SET NOT NULL).

-- ============================================================
-- transactions: fitidKey + contentHash + índices
-- ============================================================
ALTER TABLE "transactions" ADD COLUMN "fitidKey" TEXT;
ALTER TABLE "transactions" ADD COLUMN "contentHash" TEXT;

CREATE INDEX "transactions_bankAccountId_fitidKey_idx"
  ON "transactions"("bankAccountId", "fitidKey");

CREATE INDEX "transactions_bankAccountId_contentHash_idx"
  ON "transactions"("bankAccountId", "contentHash");

-- ============================================================
-- ofx_imports: fileHash + source
-- ============================================================
ALTER TABLE "ofx_imports" ADD COLUMN "fileHash" TEXT;
ALTER TABLE "ofx_imports" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'OFX';

CREATE INDEX "ofx_imports_bankAccountId_fileHash_idx"
  ON "ofx_imports"("bankAccountId", "fileHash");

-- ============================================================
-- imported_identities (tabela nova)
-- ============================================================
CREATE TABLE "imported_identities" (
  "id"              TEXT PRIMARY KEY,
  "companyId"       TEXT NOT NULL,
  "bankAccountId"   TEXT NOT NULL,
  "importBatchId"   TEXT NOT NULL,
  "fitidKey"        TEXT,
  "contentHash"     TEXT NOT NULL,
  "transactionId"   TEXT,
  "tombstone"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "imported_identities_bankAccountId_fitidKey_idx"
  ON "imported_identities"("bankAccountId", "fitidKey");
CREATE INDEX "imported_identities_bankAccountId_contentHash_idx"
  ON "imported_identities"("bankAccountId", "contentHash");
CREATE INDEX "imported_identities_importBatchId_idx"
  ON "imported_identities"("importBatchId");
CREATE INDEX "imported_identities_transactionId_idx"
  ON "imported_identities"("transactionId");
CREATE INDEX "imported_identities_companyId_createdAt_idx"
  ON "imported_identities"("companyId", "createdAt");

ALTER TABLE "imported_identities"
  ADD CONSTRAINT "imported_identities_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imported_identities"
  ADD CONSTRAINT "imported_identities_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "ofx_imports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "imported_identities"
  ADD CONSTRAINT "imported_identities_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
