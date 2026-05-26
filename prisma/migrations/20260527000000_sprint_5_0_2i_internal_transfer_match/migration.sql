-- Sprint 5.0.2.i — Conciliação automática transferências internas (grupo).
-- linkedTransactionId une as 2 pontas (empresa A saída ↔ empresa B entrada).

ALTER TABLE "transactions" ADD COLUMN "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN "linkedTransactionId" TEXT;

CREATE UNIQUE INDEX "transactions_linkedTransactionId_key" ON "transactions"("linkedTransactionId");
CREATE INDEX "transactions_isInternalTransfer_idx" ON "transactions"("isInternalTransfer");
