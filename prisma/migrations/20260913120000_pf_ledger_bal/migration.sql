-- PF FASE 1 (13/09/2026) — A ÂNCORA DO SALDO DECLARADO NA CONTA PESSOAL.
--
-- A investigação mostrou que `personal_bank_accounts` não tinha onde guardar o saldo que o
-- BANCO declara (`<LEDGERBAL>` do OFX) — e sem ele a conferência BATE/DIVERGE que o dono
-- pediu não tem em que se apoiar. A PJ tem esses dois campos desde 12/08 e é deles que vive
-- toda a série B de invariantes de saldo.
--
-- ADITIVA PURA: duas colunas nullable numa tabela com 3 linhas. Rollback = DROP COLUMN.
ALTER TABLE "personal_bank_accounts" ADD COLUMN "ledgerBal" DOUBLE PRECISION;
ALTER TABLE "personal_bank_accounts" ADD COLUMN "ledgerBalDate" TIMESTAMP(3);
