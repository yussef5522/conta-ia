-- Sprint 5.0.1 — IA Tributária Fundação.
--
-- Cria company_tax_profiles + tax_calculations.
-- Anti-dup: UNIQUE (profileId, paYear, paMonth) — recálculo é UPDATE.

BEGIN;

CREATE TABLE "company_tax_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "simplesAnexo" TEXT,
    "rba12m" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "folha12m" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proLabore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cnae" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "company_tax_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_tax_profiles_companyId_key" ON "company_tax_profiles"("companyId");
CREATE INDEX "company_tax_profiles_companyId_idx" ON "company_tax_profiles"("companyId");

ALTER TABLE "company_tax_profiles" ADD CONSTRAINT "company_tax_profiles_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_tax_profiles" ADD CONSTRAINT "company_tax_profiles_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tax_calculations" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paYear" INTEGER NOT NULL,
    "paMonth" INTEGER NOT NULL,
    "regime" TEXT NOT NULL,
    "simplesAnexo" TEXT,
    "receitaBruta" DOUBLE PRECISION NOT NULL,
    "rbaAcumulada" DOUBLE PRECISION NOT NULL,
    "folha12m" DOUBLE PRECISION NOT NULL,
    "fatorR" DOUBLE PRECISION,
    "aliquotaNominal" DOUBLE PRECISION,
    "parcelaDeduzir" DOUBLE PRECISION,
    "aliquotaEfetiva" DOUBLE PRECISION,
    "dasValue" DOUBLE PRECISION NOT NULL,
    "breakdown" TEXT NOT NULL,
    "versaoTabela" TEXT NOT NULL DEFAULT '2026',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_calculations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_calculations_profileId_paYear_paMonth_key"
    ON "tax_calculations"("profileId", "paYear", "paMonth");
CREATE INDEX "tax_calculations_companyId_paYear_paMonth_idx"
    ON "tax_calculations"("companyId", "paYear", "paMonth");

ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "company_tax_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
