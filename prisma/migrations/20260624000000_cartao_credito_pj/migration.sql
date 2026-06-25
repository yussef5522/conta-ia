-- Sprint Cartao Credito PJ (24/06/2026)
-- 100% ADITIVA: 1 tabela nova + 4 colunas nullable em transactions.
-- Sem ALTER em dados reais (Cacula transactions=3014, intactas).

CREATE TABLE "business_credit_cards" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bankName" TEXT,
  "brand" TEXT,
  "lastDigits" TEXT,
  "creditLimit" DOUBLE PRECISION NOT NULL,
  "closingDay" INTEGER NOT NULL,
  "dueDay" INTEGER NOT NULL,
  "closingDayRule" TEXT NOT NULL DEFAULT 'ATUAL',
  "defaultPaymentBankAccountId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_credit_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_credit_cards_companyId_idx" ON "business_credit_cards"("companyId");
CREATE INDEX "business_credit_cards_companyId_isActive_idx" ON "business_credit_cards"("companyId", "isActive");

ALTER TABLE "business_credit_cards" ADD CONSTRAINT "business_credit_cards_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_credit_cards" ADD CONSTRAINT "business_credit_cards_defaultPaymentBankAccountId_fkey"
  FOREIGN KEY ("defaultPaymentBankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Colunas novas em transactions
ALTER TABLE "transactions" ADD COLUMN "businessCreditCardId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "installmentNumber" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "installmentTotal" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "installmentGroupId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "isCardPayment" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_businessCreditCardId_fkey"
  FOREIGN KEY ("businessCreditCardId") REFERENCES "business_credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "transactions_businessCreditCardId_idx" ON "transactions"("businessCreditCardId");
CREATE INDEX "transactions_installmentGroupId_idx" ON "transactions"("installmentGroupId");
