-- 24/11/2026 — DIFERENÇA A MAIOR DECLARADA na fatura de cartão (mini-sprint caixa × fatura).
-- Autorização nominal do dono: "se precisar, só aditiva com pg_dump conferido antes".
-- ADITIVA: 2 ADD COLUMN NULA, sem default (nenhuma linha existente muda).
ALTER TABLE "business_card_invoices" ADD COLUMN "acrescimo" DOUBLE PRECISION;
ALTER TABLE "business_card_invoices" ADD COLUMN "acrescimoMotivo" TEXT;
