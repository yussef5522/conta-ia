-- Sprint Asaas FATIA 3C (02/06/2026) — WebhookEvent (idempotência).
--
-- Tabela nova pra registrar TODOS os eventos de webhook recebidos do
-- Asaas. Garante idempotência rígida via UNIQUE em asaasEventId.
--
-- Migration ADITIVA: nenhuma tabela existente é tocada.
-- Backup obrigatório antes do deploy (pg_dump -Fc).

CREATE TABLE "webhook_events" (
  "id"             TEXT NOT NULL,
  "asaasEventId"   TEXT NOT NULL,
  "eventType"      TEXT NOT NULL,
  "paymentId"      TEXT,
  "subscriptionId" TEXT,
  "payload"        TEXT NOT NULL,
  "status"         TEXT NOT NULL,
  "errorMessage"   TEXT,
  "processedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- Idempotência: mesmo evento não processado 2x.
-- Asaas docs: "Events have unique IDs, even when re-sent."
CREATE UNIQUE INDEX "webhook_events_asaasEventId_key" ON "webhook_events"("asaasEventId");

CREATE INDEX "webhook_events_eventType_idx"  ON "webhook_events"("eventType");
CREATE INDEX "webhook_events_paymentId_idx"  ON "webhook_events"("paymentId");
CREATE INDEX "webhook_events_status_idx"     ON "webhook_events"("status");
CREATE INDEX "webhook_events_createdAt_idx"  ON "webhook_events"("createdAt");

-- FK pra Subscription. SetNull onDelete pra preservar histórico
-- mesmo se a Subscription for excluída (cascade da exclusão de user).
ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId")
  REFERENCES "subscriptions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
