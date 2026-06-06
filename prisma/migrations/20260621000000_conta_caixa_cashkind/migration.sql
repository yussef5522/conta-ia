-- Sprint Caixa — Adiciona campo cashKind à BankAccount.
--
-- ⚠️ MIGRATION 100% ADITIVA:
--   - ADD COLUMN nullable, sem default → contas existentes ficam cashKind=NULL
--   - accountType continua String (sem CHECK/enum) → CASH é só novo valor
--     aceito pelo código, sem mudança de schema na coluna existente
--
-- 📊 IMPACTO ESPERADO em prod (caçula mix + outras):
--   - Contas existentes: cashKind = NULL (CHECKING/SAVINGS continuam intactas)
--   - Zero linha alterada de comportamento
--
-- ➕ AUSENTE DAQUI (não é migration):
--   - Categoria "Ajuste de Caixa" criada via script idempotente:
--     npx tsx scripts/backfill-categoria-ajuste-caixa.ts

ALTER TABLE "bank_accounts"
  ADD COLUMN "cashKind" TEXT;
