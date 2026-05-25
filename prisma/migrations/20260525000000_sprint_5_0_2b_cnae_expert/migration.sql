-- Sprint 5.0.2.b — CNAE Expert (Restaurantes + Academias + Comércio Roupas)
--
-- Tabela cnae_activities + FK opcional em company_tax_profiles.
-- Snapshot de expertise em colunas TEXT (compat SQLite-dev / Postgres-prod).

CREATE TABLE "cnae_activities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ramo" TEXT NOT NULL,
    "anexoSimples" TEXT,
    "expertise" TEXT NOT NULL,
    "beneficios" TEXT NOT NULL,
    "particularidades" TEXT NOT NULL,
    "errosComuns" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" TEXT NOT NULL DEFAULT '2026',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cnae_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cnae_activities_code_key" ON "cnae_activities"("code");
CREATE INDEX "cnae_activities_code_idx" ON "cnae_activities"("code");
CREATE INDEX "cnae_activities_ramo_idx" ON "cnae_activities"("ramo");

ALTER TABLE "company_tax_profiles" ADD COLUMN "cnaeActivityId" TEXT;

CREATE INDEX "company_tax_profiles_cnaeActivityId_idx" ON "company_tax_profiles"("cnaeActivityId");

ALTER TABLE "company_tax_profiles"
    ADD CONSTRAINT "company_tax_profiles_cnaeActivityId_fkey"
    FOREIGN KEY ("cnaeActivityId") REFERENCES "cnae_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
