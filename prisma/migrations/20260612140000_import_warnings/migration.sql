-- Fase 4 (Yussef 12/06/2026): detector de duplicação pós-import.
--
-- Tabela import_warnings registra suspeitas detectadas após /v2-confirm.
-- Yussef revê em /empresas/[id]/import-warnings e decide:
--   - DISMISSED: "não é dup, ignorar" → marca dismissedAt
--   - DELETED_NEW: "sim é dup, deletar a nova" → endpoint deleta newTx + reverte saldo
--
-- Migration PURAMENTE ADITIVA: CREATE TABLE + 2 índices. Zero ALTER em tabelas
-- existentes. Reverte com DROP TABLE.

CREATE TABLE "import_warnings" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "bankAccountId"   TEXT NOT NULL,
  "importId"        TEXT,
  "newTxId"         TEXT NOT NULL,
  "suspectedDupId"  TEXT NOT NULL,
  "similarity"      DOUBLE PRECISION NOT NULL,
  "reason"          TEXT NOT NULL,
  "detectedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt"     TIMESTAMP(3),
  "dismissedById"   TEXT,
  "resolvedAt"      TIMESTAMP(3),
  "resolvedById"    TEXT,
  -- DISMISSED | DELETED_NEW
  "resolution"      TEXT,

  CONSTRAINT "import_warnings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_warnings_companyId_idx" ON "import_warnings"("companyId");
CREATE INDEX "import_warnings_bankAccountId_detectedAt_idx"
  ON "import_warnings"("bankAccountId", "detectedAt" DESC);

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "ofx_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_newTxId_fkey"
  FOREIGN KEY ("newTxId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_suspectedDupId_fkey"
  FOREIGN KEY ("suspectedDupId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_dismissedById_fkey"
  FOREIGN KEY ("dismissedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_warnings"
  ADD CONSTRAINT "import_warnings_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
