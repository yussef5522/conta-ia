-- MIGRATION RECONCILE_V2 — Espelho do Extrato (StatementLine)
--
-- Atrás da flag RECONCILE_V2. NÃO APLICAR em prod até ligar o flag.
-- Gerada manualmente (não rodar `prisma migrate dev` ainda).
--
-- Adições:
--   1. statement_lines: 1 linha por <STMTTRN> de cada OFX importado (espelho cru)
--   2. ofx_imports.rawOfxBlob: conteúdo do arquivo OFX original (hoje só metadata)
--      → preenche o gap "qual era o conteúdo do Extrato_20260611.ofx?" da Rodada 5
--
-- AVISO PRÉ-EXECUÇÃO (regra CLAUDE.md):
-- (a) statement_lines: tabela NOVA, ZERO risco (não toca dados existentes)
-- (b) ofx_imports.rawOfxBlob: coluna NULLABLE → 100% aditiva, sem default que mude estado
--     Linhas existentes (16 ofx_imports em prod) ficam com NULL — sem efeito retroativo.

-- ============================================================================
-- 1. StatementLine — espelho cru de cada linha do extrato (fonte da verdade)
-- ============================================================================

CREATE TABLE "statement_lines" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "datePosted" TIMESTAMP(3) NOT NULL,
  "signedAmount" DOUBLE PRECISION NOT NULL,
  "memo" TEXT NOT NULL,
  "fitid" TEXT,
  "stableKey" TEXT NOT NULL,
  "isPreview" BOOLEAN NOT NULL DEFAULT false,
  "rawBlock" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "statement_lines_importId_idx" ON "statement_lines"("importId");
CREATE INDEX "statement_lines_bankAccountId_datePosted_idx" ON "statement_lines"("bankAccountId", "datePosted");
CREATE INDEX "statement_lines_bankAccountId_stableKey_idx" ON "statement_lines"("bankAccountId", "stableKey");

ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_importId_fkey"
  FOREIGN KEY ("importId") REFERENCES "ofx_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 2. ofx_imports.rawOfxBlob — fecha o gap "conteúdo do arquivo OFX original"
-- ============================================================================

ALTER TABLE "ofx_imports" ADD COLUMN "rawOfxBlob" TEXT;
