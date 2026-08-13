-- Sprint Contraparte-Banrisul FASE 4 (13/08/2026): registra POR ONDE o nome do
-- favorecido foi casado ('FITID' vs 'DATE_AMOUNT'). 100% ADITIVA — ADD COLUMN
-- nullable, sem default, sem backfill. Permite auditar/reverter em lote os nomes
-- preenchidos pela chave alternativa do Banrisul.
ALTER TABLE "transactions" ADD COLUMN "counterpartyMatchKey" TEXT;
