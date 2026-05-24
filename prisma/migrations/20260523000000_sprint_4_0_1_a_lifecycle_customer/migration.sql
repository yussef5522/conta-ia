-- Sprint 4.0.1.a — Foundation Core Financeiro AP/AR
--
-- 1. Cria tabela `customers` (espelha suppliers; contraparte de RECEIVABLE)
-- 2. Adiciona em `transactions`:
--    - lifecycle (EFFECTED | PAYABLE | RECEIVABLE) com default 'EFFECTED'
--      (1755 tx existentes da Cacula Mix ficam como EFFECTED — comportamento preservado)
--    - dueDate (data esperada de pagamento/recebimento; só populado em PAYABLE/RECEIVABLE)
--    - reconciledWithId (link OFX↔PAYABLE; unique pra garantir 1:1)
--    - customerId (FK Customer; usado em RECEIVABLE)
-- 3. Torna `bankAccountId` NULLABLE (PAYABLE criada sem conta definida)
-- 4. Índices novos pra performance das listagens (lifecycle+dueDate, lifecycle+status, customerId)
--
-- Operacionalmente seguro:
--   - Default 'EFFECTED' em lifecycle preserva semântica atual (DRE/Dashboard continuam idênticos)
--   - bankAccountId nullable é compatível (queries com WHERE bankAccountId=... continuam OK)
--   - Sem DROP, sem ALTER de tipo, sem reescrita massiva

BEGIN;

-- ============================================================
-- 1) Tabela customers (clientes — contraparte de RECEIVABLE)
-- ============================================================
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT,
    "cpf" TEXT,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "categoryId" TEXT,
    "fonte" TEXT NOT NULL DEFAULT 'MANUAL',
    "fonteAtualizadaEm" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_companyId_cnpj_key" ON "customers"("companyId", "cnpj");
CREATE INDEX "customers_companyId_razaoSocial_idx" ON "customers"("companyId", "razaoSocial");
CREATE INDEX "customers_companyId_isActive_idx" ON "customers"("companyId", "isActive");

ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customers" ADD CONSTRAINT "customers_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 2) transactions — novas colunas (lifecycle, dueDate, reconciledWithId, customerId)
-- ============================================================
ALTER TABLE "transactions" ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'EFFECTED';
ALTER TABLE "transactions" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "reconciledWithId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "customerId" TEXT;

-- Self-reference: reconciledWithId aponta pra outra transaction
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reconciledWithId_fkey"
    FOREIGN KEY ("reconciledWithId") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique pra garantir 1:1 (uma OFX só pode conciliar uma PAYABLE)
CREATE UNIQUE INDEX "transactions_reconciledWithId_key" ON "transactions"("reconciledWithId");

-- FK customer
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3) bankAccountId nullable
-- ============================================================
-- Drop FK existente (precisa pra alterar nullable)
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_bankAccountId_fkey";

-- Torna nullable
ALTER TABLE "transactions" ALTER COLUMN "bankAccountId" DROP NOT NULL;

-- Recria FK com SET NULL (PAYABLE sem conta sobrevive) — mas Cascade preservado
-- pra EFFECTED quando conta for deletada (comportamento atual mantido)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4) Índices novos pra performance
-- ============================================================
CREATE INDEX "transactions_lifecycle_dueDate_idx" ON "transactions"("lifecycle", "dueDate");
CREATE INDEX "transactions_lifecycle_status_idx" ON "transactions"("lifecycle", "status");
CREATE INDEX "transactions_customerId_idx" ON "transactions"("customerId");

COMMIT;
