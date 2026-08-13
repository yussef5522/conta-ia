-- Sprint TransferSuggestionEvent (13/08/2026): registro sugestão→desfecho do motor
-- de par. 100% ADITIVA — CREATE TABLE nova + FK pra companies (cascade). Nenhuma
-- tabela existente alterada, nenhum dado tocado.
CREATE TABLE "transfer_suggestion_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "debitTxId" TEXT NOT NULL,
    "creditTxId" TEXT NOT NULL,
    "layer" TEXT,
    "confidence" DOUBLE PRECISION,
    "evidences" TEXT,
    "engine" TEXT NOT NULL DEFAULT 'unified',
    "outcome" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "transfer_suggestion_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transfer_suggestion_events_debitTxId_creditTxId_key" ON "transfer_suggestion_events"("debitTxId", "creditTxId");
CREATE INDEX "transfer_suggestion_events_companyId_outcome_idx" ON "transfer_suggestion_events"("companyId", "outcome");
ALTER TABLE "transfer_suggestion_events" ADD CONSTRAINT "transfer_suggestion_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
