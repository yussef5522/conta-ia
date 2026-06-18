-- Sprint Empréstimos AI/Contrato (17/06/2026)
--
-- Aditiva pura: novos campos pra (1) pós-fixado + indexação CDI/SELIC,
-- (2) entrada em andamento pelo saldo devedor atual, (3) parcelas estimadas
-- que recebem o VALOR REAL quando conciliam.
--
-- ⚠️ ALTERs em tabelas com DADOS REAIS
--
-- | Tabela              | Operação                                    | Tipo               | Linhas afetadas | Risco | Mitigação |
-- |---------------------|---------------------------------------------|--------------------|-----------------|-------|-----------|
-- | loans               | ADD COLUMN rateType/indexer/indexerPercent  | Aditivo nullable   | 0 (vazia)       | Zero  | Nullable, sem default |
-- | loans               | ADD COLUMN outstandingBalanceInitial        | Aditivo nullable   | 0               | Zero  | Idem |
-- | loans               | ADD COLUMN trackingStartDate                | Aditivo nullable   | 0               | Zero  | Idem |
-- | loans               | ADD COLUMN installmentsPaidBefore int default 0 | Aditivo NOT NULL default | 0      | Zero  | Default 0; loans futuros usam |
-- | loans               | ADD COLUMN amortizationConstant             | Aditivo nullable   | 0               | Zero  | Idem |
-- | loans               | ADD COLUMN carencia int default 0           | Aditivo NOT NULL default | 0      | Zero  | Default 0 = sem carência |
-- | loans               | ADD COLUMN tarifas float default 0          | Aditivo NOT NULL default | 0      | Zero  | Default 0 |
-- | loan_installments   | ADD COLUMN isEstimate bool default false    | Aditivo NOT NULL default | 0      | Zero  | Default false → comportamento atual preservado |
-- | loan_installments   | ADD COLUMN correcao float default 0         | Aditivo NOT NULL default | 0      | Zero  | Idem |
-- | loan_installments   | ADD COLUMN realPayment                      | Aditivo nullable   | 0               | Zero  | Idem |

ALTER TABLE "loans"
  ADD COLUMN "rateType"                  TEXT,
  ADD COLUMN "indexer"                   TEXT,
  ADD COLUMN "indexerPercent"            DOUBLE PRECISION,
  ADD COLUMN "outstandingBalanceInitial" DOUBLE PRECISION,
  ADD COLUMN "trackingStartDate"         TIMESTAMP(3),
  ADD COLUMN "installmentsPaidBefore"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "amortizationConstant"      DOUBLE PRECISION,
  ADD COLUMN "carencia"                  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tarifas"                   DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "loan_installments"
  ADD COLUMN "isEstimate"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "correcao"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "realPayment" DOUBLE PRECISION;
