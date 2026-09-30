-- ⭐⭐ ABERTURA CONFERIDA NA CONTA DE PERFIL (PF) — 30/09/2026
--
-- POR QUE: o saldo passou a ser DERIVADO do ledger em todas as portas (item 4 do sprint,
-- pra matar o drift que pôs a Stone R$ 2.112,00 acima da régua). Conta criada com saldo
-- DIGITADO e nenhum lançamento correspondente teria `Σ(tx) = 0` — e o primeiro gesto
-- zeraria a abertura em silêncio.
--
-- O PJ já resolve isso desde 01/09 com `openingBalance`/`openingDate` (a "abertura
-- conferida"). O PF não tinha o par, e por isso era a metade exposta da casa.
--
-- ⚠️ MEDIDO EM PROD ANTES (30/09): as 5 contas PF têm `balance == Σ(tx)` ao centavo, então
-- a exposição HOJE é ZERO — esta coluna fecha a porta pro FUTURO (conta nova com saldo
-- digitado), não conserta dado existente. Nenhum backfill é necessário.
--
-- ADITIVA PURA: 2 colunas NULLABLE em tabela com dados. Nenhum ALTER destrutivo, nenhum
-- default que reescreva linha. Conta existente continua com NULL = "sem abertura declarada",
-- que é exatamente o comportamento de antes.
--
-- ROLLBACK:
--   ALTER TABLE "personal_bank_accounts" DROP COLUMN "openingBalance";
--   ALTER TABLE "personal_bank_accounts" DROP COLUMN "openingDate";

ALTER TABLE "personal_bank_accounts" ADD COLUMN "openingBalance" DOUBLE PRECISION;
ALTER TABLE "personal_bank_accounts" ADD COLUMN "openingDate" TIMESTAMP(3);
