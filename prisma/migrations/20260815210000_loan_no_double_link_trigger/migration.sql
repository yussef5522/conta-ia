-- Sprint Fase 3 CAMADA 1 (15/08/2026): torna o DOUBLE-COUNT de juros IMPOSSÍVEL
-- no banco (não "testado", impossível). Uma LoanInstallment tem
-- reconciledTransactionId (vínculo 1:1) OU LoanInstallmentPayment (ponte N:1),
-- NUNCA os dois — senão o juros conta 2× no DRE (path 1:1 + path N:1). CHECK do
-- Postgres não enxerga tabela relacionada → TRIGGER. Mensagem de erro DIZ o que
-- fazer (não "trigger violation" genérico). 0 violações hoje (preview 15/08).
CREATE OR REPLACE FUNCTION loan_installment_no_double_link() RETURNS trigger AS $$
DECLARE
  has_reconciled boolean;
  has_payments boolean;
BEGIN
  IF TG_TABLE_NAME = 'loan_installment_payments' THEN
    -- criando/movendo um pagamento N:1 → a parcela não pode ter vínculo 1:1
    SELECT ("reconciledTransactionId" IS NOT NULL) INTO has_reconciled
      FROM loan_installments WHERE id = NEW."installmentId";
    IF has_reconciled THEN
      RAISE EXCEPTION 'DOUBLE-LINK BLOQUEADO: a parcela % já tem vínculo 1:1 (reconciledTransactionId). Remova o vínculo 1:1 (setar reconciledTransactionId = NULL) ANTES de criar um pagamento N:1 (LoanInstallmentPayment). Uma parcela usa UM mecanismo de vínculo, nunca os dois — senão o juros conta 2x no DRE.', NEW."installmentId";
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'loan_installments' THEN
    -- setando reconciledTransactionId → a parcela não pode ter pagamentos N:1
    IF NEW."reconciledTransactionId" IS NOT NULL
       AND (OLD."reconciledTransactionId" IS NULL OR OLD."reconciledTransactionId" <> NEW."reconciledTransactionId") THEN
      SELECT EXISTS(SELECT 1 FROM loan_installment_payments WHERE "installmentId" = NEW.id) INTO has_payments;
      IF has_payments THEN
        RAISE EXCEPTION 'DOUBLE-LINK BLOQUEADO: a parcela % já tem pagamento(s) N:1 (LoanInstallmentPayment). Remova o(s) pagamento(s) N:1 ANTES de setar reconciledTransactionId (vínculo 1:1). Uma parcela usa UM mecanismo de vínculo, nunca os dois — senão o juros conta 2x no DRE.', NEW.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lip_no_double_link BEFORE INSERT OR UPDATE ON loan_installment_payments
  FOR EACH ROW EXECUTE FUNCTION loan_installment_no_double_link();
CREATE TRIGGER trg_li_no_double_link BEFORE UPDATE ON loan_installments
  FOR EACH ROW EXECUTE FUNCTION loan_installment_no_double_link();
