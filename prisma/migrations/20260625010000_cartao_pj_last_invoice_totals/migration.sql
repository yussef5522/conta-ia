-- Sprint Cartao PJ R5 (25/06/2026)
-- 3 colunas em business_credit_cards pra armazenar metadata da ULTIMA fatura
-- importada. Usado pra alimentar o detector de pagamento por VALOR EXATO
-- no dashboard do cartao (R4 detector ja existe — agora o dashboard chama
-- ele tambem, nao so o preview do import).
--
-- 100% aditiva: 3 colunas nullable. ZERO ALTER em dados existentes.

ALTER TABLE "business_credit_cards" ADD COLUMN "lastInvoiceMonth" TEXT;
ALTER TABLE "business_credit_cards" ADD COLUMN "lastInvoiceTotalDeclared" DOUBLE PRECISION;
ALTER TABLE "business_credit_cards" ADD COLUMN "lastInvoiceTotalToPay" DOUBLE PRECISION;

-- BACKFILL Cacula:
--   Carter banrisul (final 0115): totalDeclared=2672.63, totalToPay=2654.63
--   banco caixa     (final 3883): totalDeclared=4345.95, totalToPay=4333.41
-- Valores capturados manualmente dos PDFs importados em 25/06.

UPDATE "business_credit_cards"
SET "lastInvoiceMonth" = '2026-06',
    "lastInvoiceTotalDeclared" = 2672.63,
    "lastInvoiceTotalToPay" = 2654.63
WHERE "companyId" = 'cmq17yapb00gnrndlh33sctbo'
  AND "lastDigits" = '0115';

UPDATE "business_credit_cards"
SET "lastInvoiceMonth" = '2026-06',
    "lastInvoiceTotalDeclared" = 4345.95,
    "lastInvoiceTotalToPay" = 4333.41
WHERE "companyId" = 'cmq17yapb00gnrndlh33sctbo'
  AND "lastDigits" = '3883';
