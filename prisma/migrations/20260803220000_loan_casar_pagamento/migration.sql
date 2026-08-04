-- Sprint Casar Pagamento de Empréstimo (03/08/2026)
-- ADITIVA PURA: ADD COLUMN nullable (sem default) + CREATE TABLE nova.
-- Em Postgres ADD COLUMN nullable é mudança só de metadados (instantânea), segura
-- com dados reais. NÃO toca reconciledTransactionId @unique — as 7 reconciliações
-- 1:1 existentes continuam válidas. A ponte N:1 (loan_installment_payments) é
-- aditiva pura. Uma instrução por ALTER (compatível Postgres + SQLite).

-- Loan: valor financiado (base da amortização) + tipo de carência.
ALTER TABLE "loans" ADD COLUMN "financedAmount" DOUBLE PRECISION;
ALTER TABLE "loans" ADD COLUMN "graceType" TEXT;

-- LoanInstallment: valores REAIS preenchidos na baixa (extrato).
ALTER TABLE "loan_installments" ADD COLUMN "paidInterest" DOUBLE PRECISION;
ALTER TABLE "loan_installments" ADD COLUMN "paidCorrection" DOUBLE PRECISION;
ALTER TABLE "loan_installments" ADD COLUMN "paidPenalty" DOUBLE PRECISION;
ALTER TABLE "loan_installments" ADD COLUMN "paidTotal" DOUBLE PRECISION;

-- Tabela ponte N:1 parcela ↔ transações (débito parcial).
CREATE TABLE "loan_installment_payments" (
    "id" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_installment_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loan_installment_payments_installmentId_transactionId_key" ON "loan_installment_payments"("installmentId", "transactionId");
CREATE INDEX "loan_installment_payments_installmentId_idx" ON "loan_installment_payments"("installmentId");
CREATE INDEX "loan_installment_payments_transactionId_idx" ON "loan_installment_payments"("transactionId");

ALTER TABLE "loan_installment_payments" ADD CONSTRAINT "loan_installment_payments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "loan_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_installment_payments" ADD CONSTRAINT "loan_installment_payments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
