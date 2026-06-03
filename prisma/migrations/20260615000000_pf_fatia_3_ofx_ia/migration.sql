-- Sprint PF FATIA 3 (03/06/2026) — Import OFX cartão + IA PF.
--
-- Migration 100% ADITIVA:
--   1. CREATE TABLE personal_ofx_imports
--   2. ALTER TABLE personal_transactions: 6 colunas opcionais (+ índices/FKs)
--   3. ALTER TABLE ai_learning_rules: companyId → nullable + profileId/personalCategoryId
--
-- ZERO ALTER em users, companies, transactions PJ, bank_accounts, categories,
-- subscriptions, webhook_events, socios_pf, personal_profiles, personal_bank_accounts,
-- personal_categories, credit_cards, credit_card_invoices.

-- ============================================================
-- 1. personal_ofx_imports
-- ============================================================
CREATE TABLE "personal_ofx_imports" (
  "id"                       TEXT NOT NULL,
  "profileId"                TEXT NOT NULL,
  "creditCardId"             TEXT,
  "bankAccountId"            TEXT,
  "userId"                   TEXT NOT NULL,
  "status"                   TEXT NOT NULL DEFAULT 'PROCESSING',
  "fileName"                 TEXT NOT NULL,
  "fileSize"                 INTEGER NOT NULL DEFAULT 0,
  "statementType"            TEXT NOT NULL,
  "totalTransactions"        INTEGER NOT NULL DEFAULT 0,
  "newTransactions"          INTEGER NOT NULL DEFAULT 0,
  "duplicates"               INTEGER NOT NULL DEFAULT 0,
  "autoClassified"           INTEGER NOT NULL DEFAULT 0,
  "invoicePaymentsSkipped"   INTEGER NOT NULL DEFAULT 0,
  "parcelasDetected"         INTEGER NOT NULL DEFAULT 0,
  "periodStart"              TIMESTAMP(3),
  "periodEnd"                TIMESTAMP(3),
  "detectedOrg"              TEXT,
  "detectedFid"              TEXT,
  "detectedAcctId"           TEXT,
  "ipAddress"                TEXT,
  "userAgent"                TEXT,
  "errorMessage"             TEXT,
  "revertedAt"               TIMESTAMP(3),
  "revertedById"             TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_ofx_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_ofx_imports_profileId_idx" ON "personal_ofx_imports"("profileId");
CREATE INDEX "personal_ofx_imports_creditCardId_idx" ON "personal_ofx_imports"("creditCardId");
CREATE INDEX "personal_ofx_imports_status_idx" ON "personal_ofx_imports"("status");

ALTER TABLE "personal_ofx_imports"
  ADD CONSTRAINT "personal_ofx_imports_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_ofx_imports"
  ADD CONSTRAINT "personal_ofx_imports_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_ofx_imports"
  ADD CONSTRAINT "personal_ofx_imports_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "personal_bank_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_ofx_imports"
  ADD CONSTRAINT "personal_ofx_imports_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_ofx_imports"
  ADD CONSTRAINT "personal_ofx_imports_revertedById_fkey"
  FOREIGN KEY ("revertedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2. personal_transactions — ADD COLUMN aditivo
-- ============================================================
ALTER TABLE "personal_transactions"
  ADD COLUMN "ofxImportId"           TEXT,
  ADD COLUMN "isInternational"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "internationalCurrency" TEXT,
  ADD COLUMN "classifiedByRuleId"    TEXT,
  ADD COLUMN "aiConfidence"          DOUBLE PRECISION,
  ADD COLUMN "classifiedBy"          TEXT;

CREATE INDEX "personal_transactions_ofxImportId_idx" ON "personal_transactions"("ofxImportId");

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_ofxImportId_fkey"
  FOREIGN KEY ("ofxImportId") REFERENCES "personal_ofx_imports"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_classifiedByRuleId_fkey"
  FOREIGN KEY ("classifiedByRuleId") REFERENCES "ai_learning_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. ai_learning_rules — companyId nullable + profileId/personalCategoryId
-- ============================================================
-- Postgres: derrubar UNIQUE (companyId, tipoMatch, padrao) ANTES de tornar nullable.
ALTER TABLE "ai_learning_rules" DROP CONSTRAINT IF EXISTS "ai_learning_rules_companyId_tipoMatch_padrao_key";

-- Torna companyId nullable
ALTER TABLE "ai_learning_rules" ALTER COLUMN "companyId" DROP NOT NULL;

-- Adiciona profileId + personalCategoryId
ALTER TABLE "ai_learning_rules"
  ADD COLUMN "profileId"          TEXT,
  ADD COLUMN "personalCategoryId" TEXT;

-- Recria UNIQUE PJ (companyId só preenchido → válido)
CREATE UNIQUE INDEX "ai_learning_rules_companyId_tipoMatch_padrao_key"
  ON "ai_learning_rules"("companyId", "tipoMatch", "padrao");

-- UNIQUE novo PF (profileId preenchido)
CREATE UNIQUE INDEX "ai_learning_rules_profileId_tipoMatch_padrao_key"
  ON "ai_learning_rules"("profileId", "tipoMatch", "padrao");

CREATE INDEX "ai_learning_rules_profileId_isActive_tipoMatch_idx"
  ON "ai_learning_rules"("profileId", "isActive", "tipoMatch");

ALTER TABLE "ai_learning_rules"
  ADD CONSTRAINT "ai_learning_rules_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_learning_rules"
  ADD CONSTRAINT "ai_learning_rules_personalCategoryId_fkey"
  FOREIGN KEY ("personalCategoryId") REFERENCES "personal_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
