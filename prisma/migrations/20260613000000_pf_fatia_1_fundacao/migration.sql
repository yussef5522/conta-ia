-- Sprint PF FATIA 1 (02/06/2026) — Fundação Pessoa Física.
--
-- Migration 100% ADITIVA. Cria 5 tabelas novas + 1 coluna nullable em users.
-- NENHUM ALTER em tabelas com dados reais (companies, transactions, etc).
-- Backup obrigatório antes do deploy (pg_dump -Fc).

-- ============================================================
-- 1. users.onboardingCompletedAt (nullable — users existentes ficam null)
-- ============================================================
ALTER TABLE "users" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- ============================================================
-- 2. personal_profiles
-- ============================================================
CREATE TABLE "personal_profiles" (
  "id"        TEXT NOT NULL,
  "cpf"       TEXT,
  "name"      TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'OWN',
  "birthDate" TIMESTAMP(3),
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_profiles_cpf_idx" ON "personal_profiles"("cpf");

-- ============================================================
-- 3. user_personal_profiles (vínculo N:N com role)
-- ============================================================
CREATE TABLE "user_personal_profiles" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'OWNER',
  "isSelf"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_personal_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_personal_profiles_userId_profileId_key" ON "user_personal_profiles"("userId", "profileId");
CREATE INDEX "user_personal_profiles_userId_idx" ON "user_personal_profiles"("userId");
CREATE INDEX "user_personal_profiles_profileId_idx" ON "user_personal_profiles"("profileId");

ALTER TABLE "user_personal_profiles"
  ADD CONSTRAINT "user_personal_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_personal_profiles"
  ADD CONSTRAINT "user_personal_profiles_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. personal_bank_accounts
-- ============================================================
CREATE TABLE "personal_bank_accounts" (
  "id"                   TEXT NOT NULL,
  "profileId"            TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "bankName"             TEXT,
  "bankCode"             TEXT,
  "agency"               TEXT,
  "accountNumber"        TEXT,
  "accountType"          TEXT NOT NULL DEFAULT 'CHECKING',
  "balance"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT true,
  "creditLimit"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lowBalanceThreshold"  DOUBLE PRECISION,
  "isActive"             BOOLEAN NOT NULL DEFAULT true,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_bank_accounts_profileId_idx" ON "personal_bank_accounts"("profileId");

ALTER TABLE "personal_bank_accounts"
  ADD CONSTRAINT "personal_bank_accounts_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 5. personal_categories
-- ============================================================
CREATE TABLE "personal_categories" (
  "id"        TEXT NOT NULL,
  "profileId" TEXT,
  "name"      TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "color"     TEXT,
  "icon"      TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "parentId"  TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_categories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_categories_profileId_idx" ON "personal_categories"("profileId");
CREATE INDEX "personal_categories_parentId_idx" ON "personal_categories"("parentId");

ALTER TABLE "personal_categories"
  ADD CONSTRAINT "personal_categories_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_categories"
  ADD CONSTRAINT "personal_categories_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "personal_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 6. personal_transactions
-- ============================================================
CREATE TABLE "personal_transactions" (
  "id"            TEXT NOT NULL,
  "profileId"     TEXT NOT NULL,
  "bankAccountId" TEXT,
  "categoryId"    TEXT,
  "date"          TIMESTAMP(3) NOT NULL,
  "description"   TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "type"          TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'RECONCILED',
  "origin"        TEXT NOT NULL DEFAULT 'MANUAL',
  "externalId"    TEXT,
  "dedupHash"     TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_transactions_profileId_date_idx" ON "personal_transactions"("profileId", "date");
CREATE INDEX "personal_transactions_bankAccountId_idx" ON "personal_transactions"("bankAccountId");
CREATE INDEX "personal_transactions_categoryId_idx" ON "personal_transactions"("categoryId");

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "personal_bank_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "personal_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
