-- Sprint Empréstimos Backend (17/06/2026) — 2 tabelas novas.
--
-- ⚠️ ALTERs em tabelas com DADOS REAIS
--
-- | Tabela              | Operação                              | Tipo                | Linhas afetadas | Risco | Mitigação |
-- |---------------------|---------------------------------------|---------------------|-----------------|-------|-----------|
-- | loans               | CREATE TABLE                          | Tabela nova         | 0               | Zero  | — |
-- | loan_installments   | CREATE TABLE                          | Tabela nova         | 0               | Zero  | — |
-- | transactions        | Adiciona FK reversa via Loan/Installment (sem alterar coluna) | Aditivo via outro lado | 3000+ | Zero | FK sai dos novos models apontando pra transactions.id; SetNull no delete |
--
-- Liberação = passivo (CREDIT no extrato linkado via disbursementTransactionId)
-- Parcela paga = LoanInstallment.reconciledTransactionId aponta pra DEBIT
-- DRE filtra ambas (FASE 3): liberação fora, parcela só conta juros.

-- ----------- loans -----------
CREATE TABLE "loans" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "lender" TEXT NOT NULL,
  "contractNumber" TEXT,
  "principal" DOUBLE PRECISION NOT NULL,
  "interestRateMonthly" DOUBLE PRECISION NOT NULL,
  "termMonths" INTEGER NOT NULL,
  "amortizationSystem" TEXT NOT NULL,
  "firstDueDate" TIMESTAMP(3) NOT NULL,
  "iof" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "disbursementDate" TIMESTAMP(3) NOT NULL,
  "disbursementTransactionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loans_disbursementTransactionId_key"
  ON "loans"("disbursementTransactionId");

CREATE INDEX "loans_companyId_idx" ON "loans"("companyId");
CREATE INDEX "loans_bankAccountId_idx" ON "loans"("bankAccountId");
CREATE INDEX "loans_contractNumber_idx" ON "loans"("contractNumber");

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_disbursementTransactionId_fkey"
  FOREIGN KEY ("disbursementTransactionId") REFERENCES "transactions"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;

-- ----------- loan_installments -----------
CREATE TABLE "loan_installments" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "openingBalance" DOUBLE PRECISION NOT NULL,
  "interest" DOUBLE PRECISION NOT NULL,
  "amortization" DOUBLE PRECISION NOT NULL,
  "payment" DOUBLE PRECISION NOT NULL,
  "closingBalance" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "paidDate" TIMESTAMP(3),
  "reconciledTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loan_installments_loanId_number_key"
  ON "loan_installments"("loanId", "number");

CREATE UNIQUE INDEX "loan_installments_reconciledTransactionId_key"
  ON "loan_installments"("reconciledTransactionId");

CREATE INDEX "loan_installments_dueDate_idx" ON "loan_installments"("dueDate");
CREATE INDEX "loan_installments_status_idx" ON "loan_installments"("status");

ALTER TABLE "loan_installments"
  ADD CONSTRAINT "loan_installments_loanId_fkey"
  FOREIGN KEY ("loanId") REFERENCES "loans"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "loan_installments"
  ADD CONSTRAINT "loan_installments_reconciledTransactionId_fkey"
  FOREIGN KEY ("reconciledTransactionId") REFERENCES "transactions"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;
