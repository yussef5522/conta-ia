-- Sprint 5.0.2.l — SetorPattern (knowledge base setorial) + Company.setor
-- Migration manual pra Postgres (dev SQLite usa `prisma db push`).

-- 1. Company.setor — coluna nova, nullable
ALTER TABLE "companies" ADD COLUMN "setor" TEXT;

-- 2. SetorPattern — tabela nova
CREATE TABLE "setor_patterns" (
  "id" TEXT NOT NULL,
  "setor" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "categoryName" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  "description" TEXT,
  "origem" TEXT NOT NULL DEFAULT 'CURATED',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "setor_patterns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "setor_patterns_setor_active_idx" ON "setor_patterns"("setor", "active");
CREATE INDEX "setor_patterns_pattern_idx" ON "setor_patterns"("pattern");

-- 3. Backfill heurístico: mapeia Company.type → Company.setor.
-- Valores existentes em produção (Demo + Cacula Mix):
--   - "RESTAURANT" → RESTAURANTE
--   - "SERVICE" + tradeName contém Academia → ACADEMIA
--   - "RETAIL" → VAREJO_GERAL
--   - Outros → null (pipeline cai só nas regras UNIVERSAL)
UPDATE "companies"
SET "setor" = CASE UPPER("type")
  WHEN 'RESTAURANT' THEN 'RESTAURANTE'
  WHEN 'RETAIL' THEN 'VAREJO_GERAL'
  WHEN 'MIXED' THEN 'VAREJO_GERAL'
  ELSE NULL
END
WHERE "setor" IS NULL;
