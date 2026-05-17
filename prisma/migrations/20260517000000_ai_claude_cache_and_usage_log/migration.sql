-- Fase 3 Etapa 3 — Camada 3 do Pipeline IA Contadora.
-- Tabelas pra cache de sugestões Claude + log de uso (rate limit + custo).

-- AiClaudeCache: evita repetir chamadas pra descrições normalizadas iguais.
CREATE TABLE "ai_claude_cache" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "cacheKey"      TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "suggestion"    TEXT NOT NULL,
  "usageCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_claude_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_claude_cache_companyId_cacheKey_key"
  ON "ai_claude_cache"("companyId", "cacheKey");
CREATE INDEX "ai_claude_cache_companyId_createdAt_idx"
  ON "ai_claude_cache"("companyId", "createdAt");

ALTER TABLE "ai_claude_cache"
  ADD CONSTRAINT "ai_claude_cache_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AiUsageLog: rate-limit + telemetria de custo + auditoria.
CREATE TABLE "ai_usage_log" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "userId"          TEXT,
  "transactionId"   TEXT,
  "claudeApiCalled" BOOLEAN NOT NULL DEFAULT true,
  "inputTokens"     INTEGER NOT NULL DEFAULT 0,
  "outputTokens"    INTEGER NOT NULL DEFAULT 0,
  "costCents"       INTEGER NOT NULL DEFAULT 0,
  "cacheHit"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_log_companyId_createdAt_idx"
  ON "ai_usage_log"("companyId", "createdAt");
CREATE INDEX "ai_usage_log_companyId_claudeApiCalled_createdAt_idx"
  ON "ai_usage_log"("companyId", "claudeApiCalled", "createdAt");

ALTER TABLE "ai_usage_log"
  ADD CONSTRAINT "ai_usage_log_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_usage_log"
  ADD CONSTRAINT "ai_usage_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
