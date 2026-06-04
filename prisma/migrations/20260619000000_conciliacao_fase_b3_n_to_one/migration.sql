-- Sprint A-effected Fase B.3 (04/06/2026) — Support N:1 (várias APs → 1 OFX).
--
-- ⚠️ ALTERs em tabela com DADOS REAIS (transactions, 3014 linhas, 3 com link):
--
-- Operação 1: DROP CONSTRAINT transactions_reconciledWithId_key
--   - Remove a constraint UNIQUE em reconciledWithId
--   - NÃO toca em linhas (só schema)
--   - Risco: baixo (3 camadas de guards reconciledFrom + flag
--     allowMultiReconcile no lib reconcile + validação de soma exata
--     no endpoint find-and-match/reconcile substituem a defesa)
--
-- Operação 2: CREATE INDEX transactions_reconciledWithId_idx
--   - Índice não-único pra mesma coluna (busca rápida do reconciledFrom reverso)
--   - NÃO toca em linhas
--
-- Operação 3: ADD COLUMN reconcileGroupId String? (nullable)
--   - Grupo das N candidates conciliadas via Find & Match N:1
--   - NULL implícito em todas as 3014 linhas existentes
--   - Aditivo puro
--
-- Operação 4: CREATE INDEX transactions_reconcileGroupId_idx
--   - Pra lookup de "todas as candidates do grupo X" no Desfazer Grupo
--
-- Validação pré→pós (script):
--   - SELECT COUNT(*) FROM transactions → 3014 = 3014 ✓
--   - SELECT COUNT(*) FROM transactions WHERE reconciledWithId IS NOT NULL → 3 = 3 ✓
--   - SELECT COUNT(*) FROM transactions WHERE "reconcileGroupId" IS NOT NULL → 0 (novo) ✓
--   - Conciliações existentes (Nestle/Lamana/DISTRIB) preservadas

-- 1. Remove UNIQUE INDEX em reconciledWithId
--    (Prisma criou como unique index, não como named constraint)
DROP INDEX IF EXISTS "transactions_reconciledWithId_key";

-- 2. Recria como índice normal (não-único)
CREATE INDEX IF NOT EXISTS "transactions_reconciledWithId_idx" ON "transactions"("reconciledWithId");

-- 3. Adiciona coluna reconcileGroupId nullable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reconcileGroupId" TEXT;

-- 4. Índice em reconcileGroupId pra lookups rápidos do Desfazer Grupo
CREATE INDEX IF NOT EXISTS "transactions_reconcileGroupId_idx" ON "transactions"("reconcileGroupId");
