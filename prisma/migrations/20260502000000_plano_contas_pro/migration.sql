-- Migration: Plano de Contas profissional + Centro de Custo + Audit log de Categoria.
-- Fase A do Sistema de Plano de Contas (FASE 3+4 BLOCO B).
--
-- Mudanças em `categories`:
--   * isDefault → isSystemDefault (rename + semântica mais explícita)
--   * +parentId (auto-relação para hierarquia em árvore)
--   * +dreGroup (grupo do DRE Gerencial: RECEITA_BRUTA, DEDUCOES, CMV, etc)
--   * +code (código contábil opcional, padrão SPED)
--   * +description (texto explicativo opcional)
--   * +order (Float, ordenação manual com suporte a drag-and-drop)
--   * unique [companyId, name] → [companyId, parentId, name]
--     (validação de raízes duplicadas vira app-layer pq NULLs são distintos no PG)
--
-- Tabelas novas:
--   * cost_centers (matriz/filial — agrupador transversal, hierarquia em árvore)
--   * category_history (audit log: rastreabilidade contábil + LGPD)
--
-- Mudanças em `transactions`:
--   * +costCenterId (FK opcional pra centro de custo)

-- ============================================================
-- AlterTable: categories — rename + novas colunas
-- ============================================================
ALTER TABLE "categories" RENAME COLUMN "isDefault" TO "isSystemDefault";

ALTER TABLE "categories" ADD COLUMN "parentId" TEXT;
ALTER TABLE "categories" ADD COLUMN "dreGroup" TEXT;
ALTER TABLE "categories" ADD COLUMN "code" TEXT;
ALTER TABLE "categories" ADD COLUMN "description" TEXT;
ALTER TABLE "categories" ADD COLUMN "order" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Troca da unique constraint
DROP INDEX "categories_companyId_name_key";
CREATE UNIQUE INDEX "categories_companyId_parentId_name_key"
  ON "categories"("companyId", "parentId", "name");

-- Indexes pra performance da árvore e filtros por DRE
CREATE INDEX "categories_companyId_parentId_order_idx"
  ON "categories"("companyId", "parentId", "order");
CREATE INDEX "categories_companyId_dreGroup_idx"
  ON "categories"("companyId", "dreGroup");

-- Auto-FK pra hierarquia
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- CreateTable: cost_centers
-- ============================================================
CREATE TABLE "cost_centers" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "code"        TEXT,
  "description" TEXT,
  "parentId"    TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "order"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cost_centers_companyId_parentId_name_key"
  ON "cost_centers"("companyId", "parentId", "name");
CREATE INDEX "cost_centers_companyId_parentId_order_idx"
  ON "cost_centers"("companyId", "parentId", "order");
CREATE INDEX "cost_centers_companyId_isActive_idx"
  ON "cost_centers"("companyId", "isActive");

ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "cost_centers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- AlterTable: transactions — costCenterId
-- ============================================================
ALTER TABLE "transactions" ADD COLUMN "costCenterId" TEXT;

CREATE INDEX "transactions_costCenterId_idx" ON "transactions"("costCenterId");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- CreateTable: category_history
-- ============================================================
-- Audit log das mudanças em categories.
-- userId nullable: NULL quando ação foi feita pelo sistema (seed, backfill).
-- changedFields é JSON serializado: { campo: { before, after } } pra UPDATEs.
CREATE TABLE "category_history" (
  "id"            TEXT NOT NULL,
  "categoryId"    TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "userId"        TEXT,
  "action"        TEXT NOT NULL,
  "changedFields" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "category_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "category_history_companyId_categoryId_createdAt_idx"
  ON "category_history"("companyId", "categoryId", "createdAt");
CREATE INDEX "category_history_userId_createdAt_idx"
  ON "category_history"("userId", "createdAt");

ALTER TABLE "category_history" ADD CONSTRAINT "category_history_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_history" ADD CONSTRAINT "category_history_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_history" ADD CONSTRAINT "category_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
