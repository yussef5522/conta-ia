-- Migration: schema base para a IA Contadora (FASE 3+4 BLOCO B sub-etapa 4.1).
-- Adiciona:
--   * Tabela `suppliers` — fornecedores identificados (MANUAL ou via BrasilAPI lookup por CNPJ)
--   * Tabela `ai_learning_rules` — regras de classificação aprendidas das confirmações manuais
--   * 4 colunas em `transactions` para rastreabilidade da classificação automática
--
-- Multi-tenant: tudo escopo por companyId, com unique [companyId, ...] permitindo
-- mesmo CNPJ ou mesma regra existirem em empresas diferentes.
--
-- Pipeline futuro (4.2 → 4.3 → 4.4): match em rules → CNPJ via BrasilAPI → Claude Haiku.

-- CreateTable: suppliers
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "categoryId" TEXT,
    "cnaePrincipal" TEXT,
    "fonte" TEXT NOT NULL DEFAULT 'MANUAL',
    "fonteAtualizadaEm" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_learning_rules
CREATE TABLE "ai_learning_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tipoMatch" TEXT NOT NULL,
    "padrao" TEXT NOT NULL,
    "categoryId" TEXT,
    "supplierId" TEXT,
    "confianca" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "vezesAplicada" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fonte" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_learning_rules_pkey" PRIMARY KEY ("id")
);

-- AlterTable: transactions ganha 4 colunas para classificação automática
-- Mesmo CNPJ pode existir em duas empresas-cliente diferentes; idem regras.
-- Linhas existentes ficam com NULL, sem efeito até a sub-etapa 4.2 começar a popular.
ALTER TABLE "transactions" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "classifiedByRuleId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "aiConfidence" DOUBLE PRECISION;
ALTER TABLE "transactions" ADD COLUMN "classificationSource" TEXT;

-- Indexes: suppliers
-- Mesmo CNPJ pode existir em empresas-cliente diferentes; NULLs distintos no PG permitem
-- múltiplos suppliers sem CNPJ na mesma empresa (identificados só por nome).
CREATE UNIQUE INDEX "suppliers_companyId_cnpj_key" ON "suppliers"("companyId", "cnpj");
CREATE INDEX "suppliers_companyId_razaoSocial_idx" ON "suppliers"("companyId", "razaoSocial");
CREATE INDEX "suppliers_companyId_isActive_idx" ON "suppliers"("companyId", "isActive");

-- Indexes: ai_learning_rules
-- Não pode haver duas regras com mesmo padrão e tipo na mesma empresa.
-- Index secundário acelera o lookup do pipeline (4.2): filtra ativas por empresa e tipo.
CREATE UNIQUE INDEX "ai_learning_rules_companyId_tipoMatch_padrao_key" ON "ai_learning_rules"("companyId", "tipoMatch", "padrao");
CREATE INDEX "ai_learning_rules_companyId_isActive_tipoMatch_idx" ON "ai_learning_rules"("companyId", "isActive", "tipoMatch");

-- Foreign Keys: suppliers
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys: ai_learning_rules
ALTER TABLE "ai_learning_rules" ADD CONSTRAINT "ai_learning_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_learning_rules" ADD CONSTRAINT "ai_learning_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_learning_rules" ADD CONSTRAINT "ai_learning_rules_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys: transactions (colunas novas)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_classifiedByRuleId_fkey" FOREIGN KEY ("classifiedByRuleId") REFERENCES "ai_learning_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
