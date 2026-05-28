-- Hotfix 5.0.4.0c1-fix — Seletor de período + modo automático.
--
-- ESTRATÉGIA: repurpose os 2 campos existentes (currentPeriod/basePeriod)
-- como START dates em ISO YYYY-MM-DD (compatível com YYYY-MM antigo —
-- "2026-05" parseia como "2026-05-01"). Adiciona 3 campos:
-- - currentEndPeriod: end date do período principal
-- - baseEndPeriod:    end date do período de comparação (NULL em evolution/single)
-- - mode:             'comparative' | 'evolution' | 'single'
--
-- Zero breaking change em logs antigos.

ALTER TABLE "ai_insights_log"
  ADD COLUMN "currentEndPeriod" TEXT,
  ADD COLUMN "baseEndPeriod" TEXT,
  ADD COLUMN "mode" TEXT;

-- Index novo pra cache lookup (substitui o existente que era por currentPeriod/basePeriod).
-- Mantemos o antigo pra não quebrar logs antigos durante transição.
CREATE INDEX "ai_insights_log_cache_v2_idx"
  ON "ai_insights_log"("companyId", "feature", "mode", "currentPeriod", "currentEndPeriod", "basePeriod", "baseEndPeriod", "createdAt");
