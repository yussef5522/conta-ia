-- Sprint Dívida Arafat (05/08/2026) — ADITIVA PURA: ADD COLUMN nullable.
-- Observação livre do empréstimo (contexto pra tela). Metadados só, segura.
ALTER TABLE "loans" ADD COLUMN "notes" TEXT;
