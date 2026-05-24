-- Sprint 4.0.4 — preferências de email alerts no User.
--
-- 2 colunas opt-in (default false / DAILY) — preserva comportamento atual
-- pra users existentes (NÃO recebem email sem ativar manualmente em
-- /configuracoes/alertas).

BEGIN;

ALTER TABLE "users" ADD COLUMN "emailAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "emailAlertsFrequency" TEXT NOT NULL DEFAULT 'DAILY';

COMMIT;
