-- Sprint Central de Transferências — adiciona flag pra "Não é transferência"
-- Migration ADITIVA pura: 1 coluna nullable. Zero backfill, zero ALTER em dados
-- existentes. Linhas existentes ficam com NULL = ainda candidatas pra detecção
-- retroativa (comportamento desejado).
--
-- Reversibilidade: DROP COLUMN reverte. Sem dado pra recuperar.

ALTER TABLE "transactions" ADD COLUMN "transferDismissedAt" TIMESTAMP(3);
