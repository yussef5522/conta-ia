-- Sprint Fatura-Paga-Por-Competencia (14/08/2026): a competencia (YYYY-MM) que um
-- pagamento de cartao (isCardPayment=true) QUITA. Torna "paga" um FATO por fatura,
-- nao um chute por cartao.
--
-- 100% ADITIVA — ADD COLUMN nullable TEXT, sem default, sem backfill. Linhas
-- existentes ficam NULL (nenhum pagamento amarrado a fatura ainda; o backfill dos
-- pagamentos ja casados vem DEPOIS, com preview). Compativel sqlite (dev) + postgres.
--
-- ⚠️ ALTER em tabela com DADOS REAIS — transactions:
--   | coluna           | operacao            | tipo | linhas | risco | mitigacao
--   | paidInvoiceMonth | ADD COLUMN nullable | TEXT | ~2900  | nulo  | aditiva pura, sem default
ALTER TABLE "transactions" ADD COLUMN "paidInvoiceMonth" TEXT;
CREATE INDEX "transactions_businessCreditCardId_paidInvoiceMonth_idx" ON "transactions"("businessCreditCardId", "paidInvoiceMonth");
