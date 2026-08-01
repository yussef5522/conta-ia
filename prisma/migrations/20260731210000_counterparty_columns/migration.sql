-- Sprint Contraparte PIX (31/07/2026) — 4 colunas nullable em `transactions` pra
-- guardar a contraparte (favorecido/pagador) do PIX/TED separada da description.
--
-- ADITIVA PURA: ADD COLUMN nullable, SEM default. Em Postgres é mudança só de
-- metadados (instantânea, sem reescrever a tabela), segura mesmo com dados reais
-- em todas as empresas. Uma instrução por ALTER (compatível Postgres + SQLite).
--
-- NÃO altera `description` (que alimenta stableKey da reconciliação e o
-- computeCacheKey do categorizador) — a contraparte vive SÓ nestas colunas.
--
-- ⚠️ LGPD: "counterpartyName" e "counterpartyDocument" são DADO PESSOAL de
-- terceiro. Mesmo gate de permissão das transações. NUNCA logar em log de app.

ALTER TABLE "transactions" ADD COLUMN "counterpartyName" TEXT;
ALTER TABLE "transactions" ADD COLUMN "counterpartyDocument" TEXT;
ALTER TABLE "transactions" ADD COLUMN "counterpartySource" TEXT;
ALTER TABLE "transactions" ADD COLUMN "counterpartyConfidence" TEXT;
