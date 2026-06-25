-- Sprint Cartao PJ FIX (24/06/2026)
--
-- A constraint "effected_needs_bank_or_cash_or_reconcile" rejeita compras de
-- cartao de credito PJ porque elas tem bankAccountId=NULL (vao pro cartao,
-- nao pro banco). Esta migration ESTENDE a constraint adicionando uma 5a
-- alternativa: businessCreditCardId IS NOT NULL.
--
-- 100% ADITIVA logicamente: TODAS as tx que passavam antes continuam
-- passando — so adicionamos 1 alternativa nova. Tx pre-existentes (~2552
-- na Cacula) NAO sao revalidadas; a constraint vale so pra novas inserts/updates.

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "effected_needs_bank_or_cash_or_reconcile";

ALTER TABLE "transactions" ADD CONSTRAINT "effected_needs_bank_or_cash_or_reconcile" CHECK (
  lifecycle <> 'EFFECTED'
  OR "bankAccountId" IS NOT NULL
  OR "cashCoded" = true
  OR "reconciledWithId" IS NOT NULL
  OR type = 'TRANSFER'
  OR "businessCreditCardId" IS NOT NULL
);
