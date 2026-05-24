-- Sprint 4.0.1.b — Recurrence (recorrentes).
--
-- 1. Cria tabela `recurring_schedules` (compromissos periódicos: folha, aluguel, mensalidade)
-- 2. Adiciona em `transactions`:
--    - recurringScheduleId (FK opcional — null em tx geradas manual/OFX)
--    - Índice (recurringScheduleId) pra listagem "tx geradas por schedule X"
--    - UNIQUE (recurringScheduleId, dueDate) — anti-dup: job diário só gera 1 tx
--      por dueDate por schedule, mesmo se rodar 2x.
--
-- Sem dados existentes pra backfill (Sprint 4.0.1.a entregou Customer + lifecycle,
-- 4.0.1.b agora adiciona recurrence on top).

BEGIN;

-- ============================================================
-- 1) Tabela recurring_schedules
-- ============================================================
CREATE TABLE "recurring_schedules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "supplierId" TEXT,
    "customerId" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "recurring_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_schedules_companyId_active_idx" ON "recurring_schedules"("companyId", "active");
CREATE INDEX "recurring_schedules_type_frequency_idx" ON "recurring_schedules"("type", "frequency");

-- FKs
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 2) transactions — recurringScheduleId + anti-dup
-- ============================================================
ALTER TABLE "transactions" ADD COLUMN "recurringScheduleId" TEXT;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringScheduleId_fkey"
    FOREIGN KEY ("recurringScheduleId") REFERENCES "recurring_schedules"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "transactions_recurringScheduleId_idx" ON "transactions"("recurringScheduleId");

-- Anti-dup: schedule X só gera 1 tx por dueDate. NULL NÃO conflita com NULL
-- (postgres considera NULLs distintos em unique constraints), então tx
-- comum (recurringScheduleId NULL) não bate na regra.
CREATE UNIQUE INDEX "transactions_recurringScheduleId_dueDate_key"
    ON "transactions"("recurringScheduleId", "dueDate");

COMMIT;
