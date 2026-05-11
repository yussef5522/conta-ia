-- Migration: Sprint 0.5 Dia 1 — Transferências entre contas + Saldo negativo.
-- Adiciona base pro Dashboard Mundial (Sprints 1-3) tratar corretamente:
--   1. Transferências internas entre contas da MESMA empresa (não inflam DRE).
--   2. Saldo negativo / cheque especial (regra, não exceção, nas 13 academias).
-- Sintaxe PostgreSQL — em dev (SQLite) usar `prisma db push`.

-- Transferências entre contas: campo que une as 2 pontas do par TRANSFER.
ALTER TABLE "transactions" ADD COLUMN "transferGroupId" TEXT;
CREATE INDEX "transactions_transferGroupId_idx" ON "transactions"("transferGroupId");

-- Saldo negativo / cheque especial em bank_accounts.
ALTER TABLE "bank_accounts" ADD COLUMN "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "bank_accounts" ADD COLUMN "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "bank_accounts" ADD COLUMN "lowBalanceThreshold" DOUBLE PRECISION;
