-- Sprint Account Kind PJ/PF (27/06/2026, modelo QuickBooks/Wave/FreshBooks).
--
-- ADITIVA PURA: nova coluna TEXT NOT NULL DEFAULT 'PJ' em bank_accounts.
-- Preenche todas as contas existentes como PJ (semântica idêntica ao mundo
-- pré-migration, que era PJ-only). Conta PF nova vira optar pelo seletor.

ALTER TABLE "bank_accounts"
  ADD COLUMN "accountKind" TEXT NOT NULL DEFAULT 'PJ';
