-- Sprint rawOfxBlob (13/08/2026): grava o OFX cru SEMPRE + contexto da decisão (2.4).
--
-- ⚠️ ALTERs em tabela com DADOS REAIS — ofx_imports (~124 linhas):
--   | coluna            | operação            | tipo   | risco | mitigação
--   | rawOfxBlob        | ADD COLUMN (existe) | TEXT   | nulo  | IF NOT EXISTS (já criada em 20260612210000)
--   | blobPurgedAt      | ADD COLUMN nullable | TS     | nulo  | aditiva pura
--   | futureDiscarded   | ADD COLUMN default 0| INT    | nulo  | aditiva, default não muda linha existente
--   | anchorDate/Rule   | ADD COLUMN nullable | TS/TEXT| nulo  | aditiva pura
--   | bankProfile       | ADD COLUMN nullable | TEXT   | nulo  | aditiva pura
--   | ledgerBal*        | ADD COLUMN nullable | float/bool | nulo | aditiva pura
-- Sem backfill, sem DROP, sem RENAME. Linhas existentes ficam com NULL/0.
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "rawOfxBlob" TEXT;
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "blobPurgedAt" TIMESTAMP(3);
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "futureDiscarded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "anchorDate" TIMESTAMP(3);
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "anchorRule" TEXT;
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "bankProfile" TEXT;
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "ledgerBalAmount" DOUBLE PRECISION;
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "ledgerBalMatched" BOOLEAN;
ALTER TABLE "ofx_imports" ADD COLUMN IF NOT EXISTS "ledgerBalDiff" DOUBLE PRECISION;
