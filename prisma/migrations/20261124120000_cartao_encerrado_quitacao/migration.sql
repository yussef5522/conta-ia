-- R53 (24/11/2026, docs/cartoes-referencia.html) — CARTÃO ENCERRADO EM QUITAÇÃO.
-- Autorização nominal do dono: "migration só aditiva (estado do cartão + marca de fatura de quitação)".
-- ADITIVA: 2 ADD COLUMN NULA, sem default (nenhuma linha existente muda).
ALTER TABLE "business_credit_cards" ADD COLUMN "encerradoEm" TIMESTAMP(3);
ALTER TABLE "business_card_invoices" ADD COLUMN "quitacao" BOOLEAN;
