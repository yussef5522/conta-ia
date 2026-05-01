-- Migration: troca a chave de deduplicação de OFX FITID puro para um hash interno.
-- Motivo: bancos como o Banrisul reusam FITIDs ("000001", "000002", ...) entre
-- transações distintas no mesmo arquivo, violando @@unique([bankAccountId, externalId]).
-- O hash composto (fitid + data + valor + memo) discrimina transações reais e ainda
-- detecta reimportação do mesmo arquivo. Ver lib/ofx/dedup.ts.

-- Adiciona o novo campo
ALTER TABLE "transactions" ADD COLUMN "dedupHash" TEXT;

-- Remove a unique antiga sobre externalId
DROP INDEX "transactions_bankAccountId_externalId_key";

-- Cria a nova unique sobre dedupHash.
-- NULLs continuam distintos no PostgreSQL: linhas legacy sem dedupHash não conflitam,
-- e Pluggy (que ainda não preenche dedupHash) também segue funcionando.
CREATE UNIQUE INDEX "transactions_bankAccountId_dedupHash_key" ON "transactions"("bankAccountId", "dedupHash");

-- Mantém um índice (não-unique) sobre externalId para auditoria e lookup do Pluggy.
CREATE INDEX "transactions_bankAccountId_externalId_idx" ON "transactions"("bankAccountId", "externalId");
