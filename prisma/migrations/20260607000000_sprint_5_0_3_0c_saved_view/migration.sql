-- Sprint 5.0.3.0c ELITE — SavedView (views customizadas em /contas-a-pagar).
-- Migration manual pra Postgres (dev SQLite usa `prisma db push`).
--
-- Compatível dual SQLite/Postgres: `columnOrder` / `columnHidden` ficam como
-- TEXT com JSON dentro (não `TEXT[]` postgres-only) pra simplicidade.

CREATE TABLE "saved_views" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "empresaId" TEXT,
  -- "payable" (default) | "receivable" | "transactions" | etc — pra reuso futuro
  "scope" TEXT NOT NULL DEFAULT 'payable',
  "name" TEXT NOT NULL,
  -- emoji curto (1-4 chars)
  "icon" TEXT,
  -- JSON dos filtros aplicados: { status, dateRange, categoryIds, supplierIds, ... }
  "filters" TEXT NOT NULL,
  "sortBy" TEXT,
  "sortDir" TEXT,
  -- JSON arrays como TEXT pra dual-DB compat
  "columnOrder" TEXT NOT NULL DEFAULT '[]',
  "columnHidden" TEXT NOT NULL DEFAULT '[]',
  "density" TEXT NOT NULL DEFAULT 'normal',
  "pinnedOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- Index pra lookup do usuário + empresa + scope (lista de views da página)
CREATE INDEX "saved_views_userId_empresaId_scope_idx"
  ON "saved_views"("userId", "empresaId", "scope");

-- Único: usuário não pode ter 2 views com mesmo nome no mesmo escopo+empresa
-- (NULL em empresaId = view "global" — também tem unique por nome ali)
CREATE UNIQUE INDEX "saved_views_userId_empresaId_scope_name_key"
  ON "saved_views"("userId", "empresaId", "scope", "name");

-- FK cascade pra cleanup quando usuário é deletado
ALTER TABLE "saved_views"
  ADD CONSTRAINT "saved_views_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
