-- Sprint Importar Agenda do Banco (04/08/2026)
-- ADITIVA PURA: ADD COLUMN nullable. Marca se a agenda do empréstimo foi GERADA
-- por fórmula ou IMPORTADA do documento oficial do banco (verdade). Nullable até
-- o cadastro ser tocado. Metadados só (instantâneo em Postgres, seguro com dados).

ALTER TABLE "loans" ADD COLUMN "scheduleSource" TEXT;
