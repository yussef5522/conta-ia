-- Sprint 5.0.2.s — Categoria gera crédito PIS/COFINS Lucro Real.
-- Default false. Backfilled em ensureAllSystemCategories conforme setor.

ALTER TABLE "categories"
  ADD COLUMN "isCreditavel" BOOLEAN NOT NULL DEFAULT false;
