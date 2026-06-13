-- Fase 5 (Yussef 12/06/2026): métricas diárias de monitoramento.
--
-- monitor_metrics: snapshot diário do cron job
-- monitor_alerts: alertas disparados quando uma métrica SUBE vs ontem
--
-- PURAMENTE ADITIVA: 2× CREATE TABLE + 4 índices. Zero ALTER em tabelas
-- existentes. Reverte com DROP TABLE.

CREATE TABLE "monitor_metrics" (
  "id"         TEXT NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metricKey"  TEXT NOT NULL,
  "companyId"  TEXT,
  "value"      INTEGER NOT NULL,
  "metadata"   TEXT,

  CONSTRAINT "monitor_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monitor_metrics_metricKey_measuredAt_idx"
  ON "monitor_metrics"("metricKey", "measuredAt" DESC);

ALTER TABLE "monitor_metrics"
  ADD CONSTRAINT "monitor_metrics_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "monitor_alerts" (
  "id"            TEXT NOT NULL,
  "metricKey"     TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "valueOntem"    INTEGER NOT NULL,
  "valueHoje"     INTEGER NOT NULL,
  "delta"         INTEGER NOT NULL,
  "detectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt"   TIMESTAMP(3),
  "dismissedById" TEXT,

  CONSTRAINT "monitor_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monitor_alerts_companyId_dismissedAt_detectedAt_idx"
  ON "monitor_alerts"("companyId", "dismissedAt", "detectedAt" DESC);

ALTER TABLE "monitor_alerts"
  ADD CONSTRAINT "monitor_alerts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
