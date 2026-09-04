-- ⭐ RASTRO DO VENCIMENTO, v2 — e a razão de existir uma v2 em 24h é uma lição (04/09/2026).
--
-- ⛔ O QUE EU ERREI ONTEM: pus `CHECK (origem IN ('DONO','BOLETO'))` numa lista que era
-- OBVIAMENTE aberta. No dia seguinte o dono pediu uma terceira origem
-- (`DONO_NO_RECEBIMENTO`) e ampliar exigiria `ALTER TABLE ... DROP CONSTRAINT` — **proibido
-- no módulo** (migration de estoque é CREATE-only, com guard de CI).
--
-- ⭐ A LIÇÃO: **CHECK no banco é pra domínio FECHADO** (tipo `SABOR|OUTRO`, `DIA|PERIODO`).
-- Lista que cresce com o negócio mora no TypeScript, onde crescer é editar um union — e não
-- uma migration. O guard estava certo; a modelagem é que estava apertada demais.
--
-- ⚠️ A v1 (`stock_vencimento_definido`) fica no banco com **0 linhas** — nunca foi usada em
-- produção (conferido antes) — porque DROP também é proibido. Ela está marcada como
-- SUPERSEDED no schema pra ninguém escrever nela por engano.
--
-- ROLLBACK: DROP TABLE "stock_vencimento_evento";
CREATE TABLE "stock_vencimento_evento" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "companyId"     TEXT NOT NULL,
  "suggestionId"  TEXT NOT NULL,
  "dVencAnterior" TIMESTAMP(3),
  "dVencNovo"     TIMESTAMP(3) NOT NULL,
  -- DONO · BOLETO · DONO_NO_RECEBIMENTO — o conjunto vive em lib/stock/ponte/vencimento.ts
  "origem"        TEXT NOT NULL,
  "criadoPorId"   TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ⭐ o que É fechado continua travado no banco: origem vazia não existe
  CONSTRAINT "chk_vencimento_evento_origem" CHECK (length(trim("origem")) > 0)
);

CREATE INDEX "stock_vencimento_evento_companyId_idx" ON "stock_vencimento_evento" ("companyId");
CREATE INDEX "stock_vencimento_evento_suggestion_idx" ON "stock_vencimento_evento" ("companyId", "suggestionId");
