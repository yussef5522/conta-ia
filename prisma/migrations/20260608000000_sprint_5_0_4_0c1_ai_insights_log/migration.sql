-- Sprint 5.0.4.0c1 — AiInsightsLog: log + cache de insights narrativos Sonnet 4.6.
-- Migration manual pra Postgres (dev SQLite usa `prisma db push`).
--
-- Por que separar do AiUsageLog existente:
-- - Modelo diferente (Sonnet vs Haiku) → pricing diferente, tracking separado
-- - Feature diferente (narrative insights vs categorize) → métricas isoladas
-- - Cacheia o responseJson (1h TTL — usado pelo botão "Gerar novamente")

CREATE TABLE "ai_insights_log" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  -- Feature que disparou a chamada (ex: 'monthly-insights')
  "feature" TEXT NOT NULL,
  -- Modelo Anthropic usado (ex: 'claude-sonnet-4-6')
  "model" TEXT NOT NULL,
  -- Períodos comparados (YYYY-MM) — usados pra cache lookup
  "currentPeriod" TEXT,
  "basePeriod" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  -- Custo em centavos USD × 100 (mesma convenção do AiUsageLog)
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "elapsedMs" INTEGER NOT NULL DEFAULT 0,
  -- JSON estruturado com a análise gerada (cache + auditoria)
  "responseJson" TEXT,
  -- Mensagem do erro se a chamada falhou (responseJson fica NULL)
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_insights_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_insights_log_companyId_createdAt_idx"
  ON "ai_insights_log"("companyId", "createdAt");

-- Index composto pra cache lookup eficiente:
-- WHERE companyId = X AND feature = Y AND currentPeriod = Z AND basePeriod = W
-- ORDER BY createdAt DESC LIMIT 1
CREATE INDEX "ai_insights_log_cache_lookup_idx"
  ON "ai_insights_log"("companyId", "feature", "currentPeriod", "basePeriod", "createdAt");

ALTER TABLE "ai_insights_log"
  ADD CONSTRAINT "ai_insights_log_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_insights_log"
  ADD CONSTRAINT "ai_insights_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
