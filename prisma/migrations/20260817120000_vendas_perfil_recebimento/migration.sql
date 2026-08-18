-- VENDAS FASE 1 (17/08/2026) — perfil de recebimento (quando o dinheiro chega,
-- com vigência). Aditiva pura (CREATE TABLE) — zero risco. Postgres.

CREATE TABLE "perfil_recebimento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "semanaComecaEm" TEXT NOT NULL DEFAULT 'SEG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "perfil_recebimento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "perfil_recebimento_companyId_key" ON "perfil_recebimento"("companyId");

CREATE TABLE "regra_recebimento" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "meio" TEXT NOT NULL,
    "diasUteisAtraso" INTEGER NOT NULL DEFAULT 1,
    "recebeSabDom" BOOLEAN NOT NULL DEFAULT false,
    "vigenteDe" TIMESTAMP(3) NOT NULL,
    "vigenteAte" TIMESTAMP(3),
    "origemHint" TEXT,
    "confirmadoPeloDono" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "regra_recebimento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "regra_recebimento_companyId_bankAccountId_meio_vigenteDe_idx" ON "regra_recebimento"("companyId", "bankAccountId", "meio", "vigenteDe");
ALTER TABLE "regra_recebimento" ADD CONSTRAINT "regra_recebimento_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "perfil_recebimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "feriado_municipal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feriado_municipal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feriado_municipal_companyId_data_key" ON "feriado_municipal"("companyId", "data");
CREATE INDEX "feriado_municipal_companyId_idx" ON "feriado_municipal"("companyId");
