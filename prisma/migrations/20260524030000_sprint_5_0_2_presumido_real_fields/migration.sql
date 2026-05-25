-- Sprint 5.0.2 — +5 campos em company_tax_profiles pra Lucro Presumido + Real.
-- Defaults seguros: atividade/estado opcionais; flags hasICMS/hasISS false;
-- margemReal 15% (estimativa típica).

BEGIN;

ALTER TABLE "company_tax_profiles" ADD COLUMN "atividade" TEXT;
ALTER TABLE "company_tax_profiles" ADD COLUMN "estado" TEXT;
ALTER TABLE "company_tax_profiles" ADD COLUMN "hasICMS" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_tax_profiles" ADD COLUMN "hasISS" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_tax_profiles" ADD COLUMN "margemReal" DOUBLE PRECISION NOT NULL DEFAULT 15;

COMMIT;
