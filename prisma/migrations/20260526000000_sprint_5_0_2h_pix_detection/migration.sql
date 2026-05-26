-- Sprint 5.0.2.h — Detecção Pix PJ↔PF/PJ.
--
-- Cadastros de Sócios PF e Empresas Relacionadas pra detecção automática
-- de Pix entre relacionados (Distribuição Lucros, Pró-labore, Transferência grupo).
-- pixKeys serializadas como TEXT (JSON array) pra compat dual-DB.

CREATE TABLE "socios_pf" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "pixKeys" TEXT NOT NULL DEFAULT '[]',
    "papel" TEXT NOT NULL DEFAULT 'SOCIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socios_pf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "socios_pf_companyId_cpf_key"
    ON "socios_pf"("companyId", "cpf");
CREATE INDEX "socios_pf_companyId_idx"
    ON "socios_pf"("companyId");

ALTER TABLE "socios_pf"
    ADD CONSTRAINT "socios_pf_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "empresas_relacionadas" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpjRelacionado" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "pixKeys" TEXT NOT NULL DEFAULT '[]',
    "relacao" TEXT NOT NULL DEFAULT 'MESMO_GRUPO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_relacionadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "empresas_relacionadas_companyId_cnpjRelacionado_key"
    ON "empresas_relacionadas"("companyId", "cnpjRelacionado");
CREATE INDEX "empresas_relacionadas_companyId_idx"
    ON "empresas_relacionadas"("companyId");

ALTER TABLE "empresas_relacionadas"
    ADD CONSTRAINT "empresas_relacionadas_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transaction ganha campos pra rastrear partido relacionado detectado
ALTER TABLE "transactions" ADD COLUMN "relatedPartyType" TEXT;
ALTER TABLE "transactions" ADD COLUMN "relatedPartyId" TEXT;

CREATE INDEX "transactions_relatedPartyType_idx"
    ON "transactions"("relatedPartyType");
