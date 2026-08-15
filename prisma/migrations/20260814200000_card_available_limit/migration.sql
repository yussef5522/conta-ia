-- Sprint Limite-do-PDF (14/08/2026): disponível declarado na fatura. Aditiva, nullable.
ALTER TABLE "business_credit_cards" ADD COLUMN "lastInvoiceAvailableLimit" DOUBLE PRECISION;
