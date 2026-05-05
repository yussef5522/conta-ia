-- Migration: Sub-etapa 5.1.E — Restaurar Padrão com diff visual.
-- Adiciona Category.templateKey (chave lógica do template) e tabela
-- CategoryRestoreLog (audit log de operações "Restaurar Padrão").

-- 1. Campo templateKey em categories
-- null em categorias custom (isSystemDefault=false).
-- Preenchido em isSystemDefault=true via backfill em
-- scripts/backfill-template-keys.ts.
-- Formato: "SETOR:DRE_GROUP:slug_do_nome".
ALTER TABLE "categories" ADD COLUMN "templateKey" TEXT;

-- Index pra lookup rápido durante computeTemplateDiff.
CREATE INDEX "categories_templateKey_idx" ON "categories"("templateKey");

-- 2. Tabela CategoryRestoreLog
CREATE TABLE "category_restore_log" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT NOT NULL,

    CONSTRAINT "category_restore_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "category_restore_log_companyId_timestamp_idx"
  ON "category_restore_log"("companyId", "timestamp");

ALTER TABLE "category_restore_log" ADD CONSTRAINT "category_restore_log_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_restore_log" ADD CONSTRAINT "category_restore_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
