-- Sprint Cartao PJ R4 (25/06/2026)
-- Adiciona invoiceMonth (YYYY-MM) em transactions: competencia da fatura
-- capturada no import. Permite dashboard agrupar por fatura, nao por data
-- da compra (parceladas antigas tem date no passado).
-- 100% ADITIVA: coluna nullable. 0 ALTER em dados.

ALTER TABLE "transactions" ADD COLUMN "invoiceMonth" TEXT;

CREATE INDEX "transactions_businessCreditCardId_invoiceMonth_idx"
  ON "transactions"("businessCreditCardId", "invoiceMonth");

-- BACKFILL Cacula: 44 tx de cartao ja importadas (15 Caixa + 29 Banrisul)
-- ambas faturas com vencimento em 06/2026
UPDATE "transactions"
SET "invoiceMonth" = '2026-06'
WHERE "businessCreditCardId" IS NOT NULL
  AND "invoiceMonth" IS NULL
  AND "isCardPayment" = false;
