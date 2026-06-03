-- Sprint PF FATIA 3.5 (03/06/2026) — PDF via Claude Vision.
--
-- Aplicando a REGRA NOVA (CLAUDE.md) — destaque de ALTERs em tabelas
-- com dados reais:
--
-- ⚠️ ALTERs em tabelas com dados reais:
--   - personal_ofx_imports: ADD 4 COLUMNs (sourceType com DEFAULT 'OFX'
--     + extractionConfidence/pdfSha256/pdfScanQuality nullable)
--   - Linhas em prod hoje: 0 (Yussef ainda não fez import OFX em prod)
--   - Risco: 🟢 Zero — DEFAULT cobre linhas existentes; comportamento
--     igual pro fluxo OFX existente.
--
-- ➕ Tabelas novas:
--   - personal_pdf_extract_cache (cache SHA256 do PDF — sem armazenar PDF)

-- ============================================================
-- 1. personal_ofx_imports — ADD COLUMN aditivo seguro
-- ============================================================
ALTER TABLE "personal_ofx_imports"
  ADD COLUMN "sourceType"            TEXT NOT NULL DEFAULT 'OFX',
  ADD COLUMN "extractionConfidence"  DOUBLE PRECISION,
  ADD COLUMN "pdfSha256"             TEXT,
  ADD COLUMN "pdfScanQuality"        TEXT;

CREATE INDEX "personal_ofx_imports_sourceType_idx"
  ON "personal_ofx_imports"("sourceType");
CREATE INDEX "personal_ofx_imports_pdfSha256_idx"
  ON "personal_ofx_imports"("pdfSha256");

-- ============================================================
-- 2. personal_pdf_extract_cache — tabela nova
-- ============================================================
CREATE TABLE "personal_pdf_extract_cache" (
  "id"               TEXT NOT NULL,
  "pdfSha256"        TEXT NOT NULL,
  "modelVersion"     TEXT NOT NULL,
  "resultJson"       TEXT NOT NULL,
  "inputTokens"      INTEGER NOT NULL,
  "outputTokens"     INTEGER NOT NULL,
  "costCentsUsdX100" INTEGER NOT NULL,
  "ownerUserId"      TEXT,
  "hitCount"         INTEGER NOT NULL DEFAULT 0,
  "cachedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_pdf_extract_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_pdf_extract_cache_pdfSha256_key"
  ON "personal_pdf_extract_cache"("pdfSha256");
CREATE INDEX "personal_pdf_extract_cache_expiresAt_idx"
  ON "personal_pdf_extract_cache"("expiresAt");
CREATE INDEX "personal_pdf_extract_cache_ownerUserId_idx"
  ON "personal_pdf_extract_cache"("ownerUserId");

ALTER TABLE "personal_pdf_extract_cache"
  ADD CONSTRAINT "personal_pdf_extract_cache_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
