-- Sprint 5.0.2.d — AI Analysis Cache (24h TTL).
--
-- Cache de análises tributárias geradas via Claude Sonnet 4.6.
-- Hash key derivado de empresa + CNAE + regime + snapshot financeiro.

CREATE TABLE "ai_analysis_cache" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "analysis" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analysis_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_analysis_cache_companyId_cacheKey_key"
    ON "ai_analysis_cache"("companyId", "cacheKey");

CREATE INDEX "ai_analysis_cache_companyId_expiresAt_idx"
    ON "ai_analysis_cache"("companyId", "expiresAt");

ALTER TABLE "ai_analysis_cache"
    ADD CONSTRAINT "ai_analysis_cache_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
