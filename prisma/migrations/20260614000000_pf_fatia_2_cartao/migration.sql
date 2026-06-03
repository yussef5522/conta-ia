-- Sprint PF FATIA 2 (02/06/2026) — Cartão de crédito robusto.
--
-- Migration 100% ADITIVA. 2 tabelas novas + 7 colunas nullable em
-- personal_transactions. ZERO ALTER em tabelas com dados reais.
-- Backup obrigatório antes do deploy.

-- ============================================================
-- 1. credit_cards
-- ============================================================
CREATE TABLE "credit_cards" (
  "id"                      TEXT NOT NULL,
  "profileId"               TEXT NOT NULL,
  "name"                    TEXT NOT NULL,
  "bankName"                TEXT,
  "lastDigits"              TEXT,
  "brand"                   TEXT,
  "creditLimit"             DOUBLE PRECISION NOT NULL,
  "closingDay"              INTEGER NOT NULL,
  "dueDay"                  INTEGER NOT NULL,
  "closingDayRule"          TEXT NOT NULL DEFAULT 'ATUAL',
  "defaultPaymentAccountId" TEXT,
  "isActive"                BOOLEAN NOT NULL DEFAULT true,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_cards_profileId_idx" ON "credit_cards"("profileId");

ALTER TABLE "credit_cards"
  ADD CONSTRAINT "credit_cards_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_cards"
  ADD CONSTRAINT "credit_cards_defaultPaymentAccountId_fkey"
  FOREIGN KEY ("defaultPaymentAccountId") REFERENCES "personal_bank_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2. credit_card_invoices
-- ============================================================
CREATE TABLE "credit_card_invoices" (
  "id"                     TEXT NOT NULL,
  "creditCardId"           TEXT NOT NULL,
  "reference"              TEXT NOT NULL,
  "closingDate"            TIMESTAMP(3) NOT NULL,
  "dueDate"                TIMESTAMP(3) NOT NULL,
  "totalAmount"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"                 TEXT NOT NULL DEFAULT 'OPEN',
  "carryoverFromInvoiceId" TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_card_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_card_invoices_creditCardId_reference_key"
  ON "credit_card_invoices"("creditCardId", "reference");
CREATE INDEX "credit_card_invoices_creditCardId_status_idx"
  ON "credit_card_invoices"("creditCardId", "status");
CREATE INDEX "credit_card_invoices_dueDate_idx" ON "credit_card_invoices"("dueDate");

ALTER TABLE "credit_card_invoices"
  ADD CONSTRAINT "credit_card_invoices_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_card_invoices"
  ADD CONSTRAINT "credit_card_invoices_carryoverFromInvoiceId_fkey"
  FOREIGN KEY ("carryoverFromInvoiceId") REFERENCES "credit_card_invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. personal_transactions — ADD COLUMN aditivo (7 colunas)
-- ============================================================
ALTER TABLE "personal_transactions"
  ADD COLUMN "creditCardId"        TEXT,
  ADD COLUMN "creditCardInvoiceId" TEXT,
  ADD COLUMN "installmentNumber"   INTEGER,
  ADD COLUMN "installmentTotal"    INTEGER,
  ADD COLUMN "installmentGroupId"  TEXT,
  ADD COLUMN "isInvoicePayment"    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "personal_transactions_creditCardId_idx"
  ON "personal_transactions"("creditCardId");
CREATE INDEX "personal_transactions_creditCardInvoiceId_idx"
  ON "personal_transactions"("creditCardInvoiceId");
CREATE INDEX "personal_transactions_installmentGroupId_idx"
  ON "personal_transactions"("installmentGroupId");

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_creditCardId_fkey"
  FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_creditCardInvoiceId_fkey"
  FOREIGN KEY ("creditCardInvoiceId") REFERENCES "credit_card_invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
