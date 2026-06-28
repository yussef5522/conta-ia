-- Sprint Pending Transfer State (27/06/2026, modelo QuickBooks/Xero).
--
-- ADITIVA PURA: 3 colunas novas em transactions com defaults seguros que
-- preservam o comportamento existente (pendingTransfer=false em todas
-- as ~4.000 tx reais = nenhuma sai do DRE retroativamente).

ALTER TABLE "transactions"
  ADD COLUMN "pendingTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "transactions"
  ADD COLUMN "pendingTransferDirection" TEXT;

ALTER TABLE "transactions"
  ADD COLUMN "pendingTransferSince" TIMESTAMP(3);

CREATE INDEX "transactions_pendingTransfer_idx"
  ON "transactions"("pendingTransfer");
