-- Sprint CSV Import (30/05/2026) — CACULA fast-path lifecycle.
-- Aditiva. Null pro Excel/CSV genérico (confirm decide).
-- Preenchida pelo CACULA fast-path (já valida lifecycle no upload).
-- Conecta com lib/lifecycle/index.ts — guard R$ 939k (PAYABLE+paymentDate inválido).

ALTER TABLE "staged_payable_rows" ADD COLUMN "lifecycle" TEXT;
