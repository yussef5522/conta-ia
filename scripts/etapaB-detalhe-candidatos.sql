\set co '\'cmq17yapb00gnrndlh33sctbo\''

\echo '=== A) Banrisul same-FITID dups (2677.29 cartão / 2444.15 empréstimo) — vínculos? ==='
SELECT to_char(t.date,'MM-DD') AS dia, t.amount, left(t.id,12) AS tx_id, t.lifecycle, t.status,
       t."externalId" AS fitid, left(coalesce(t."importId",'-'),8) AS import,
       to_char(t."createdAt",'MM-DD HH24:MI') AS criada,
       t."isCardPayment" AS card, t."reconcileGroupId" AS rgroup, t."reconciledWithId" AS rwith,
       t."categoryId" AS cat,
       (SELECT count(*) FROM loan_installments li WHERE li."reconciledTransactionId"=t.id) AS li_vinc,
       (SELECT count(*) FROM loan_installment_payments lip WHERE lip."transactionId"=t.id) AS lip_vinc
FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"=:co AND ((t.amount=2677.29 AND t.description='PAGAMENTO CARTAO DE CREDITO')
   OR (t.amount=2444.15 AND t.description='EMPRESTIMO'))
ORDER BY t.amount, t."createdAt";

\echo ''
\echo '=== B) CAPITALIZACAO 297.84 em 07-01 E 07-02 (mesmo doc, data trocada?) ==='
SELECT to_char(t.date,'YYYY-MM-DD') AS data, left(t.id,12) AS tx_id, t.lifecycle, t.status,
       t."externalId" AS fitid, left(coalesce(t."importId",'-'),8) AS import,
       to_char(t."createdAt",'MM-DD HH24:MI') AS criada, t."reconcileGroupId" AS rgroup
FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"=:co AND t.amount=297.84 AND t.description='CAPITALIZACAO RG'
ORDER BY t.date, t."externalId";

\echo ''
\echo '=== C) par 5.000 V1 (grupo a79d2d5e) — tem vínculo loan/reconcile? ==='
SELECT left(t.id,12) AS tx_id, ba.name AS conta, t."transferDirection" AS dir, t.status,
       t."reconcileGroupId" AS rgroup, t."reconciledWithId" AS rwith, t."categoryId" AS cat,
       (SELECT count(*) FROM loan_installments li WHERE li."reconciledTransactionId"=t.id) AS li_vinc,
       (SELECT count(*) FROM loan_installment_payments lip WHERE lip."transactionId"=t.id) AS lip_vinc
FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"=:co AND t."transferGroupId"='a79d2d5e-5f39-4b56-b7ee-12077838c3cf';

\echo ''
\echo '=== D) Tier 1: os 27 RECEIVABLE a remover TÊM vínculo? (esperado 0) ==='
WITH grp AS (
  SELECT t."bankAccountId", t.date, t.amount, t.type, t.description
  FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
  WHERE ba."companyId"=:co
  GROUP BY t."bankAccountId", t.date, t.amount, t.type, t.description
  HAVING count(*)>1 AND count(*) FILTER (WHERE t.lifecycle='EFFECTED')>=1
     AND count(*) FILTER (WHERE t.lifecycle IN ('PAYABLE','RECEIVABLE'))>=1
)
SELECT count(*) AS previews,
       count(*) FILTER (WHERE t."reconcileGroupId" IS NOT NULL OR t."reconciledWithId" IS NOT NULL) AS conciliadas,
       count(*) FILTER (WHERE EXISTS(SELECT 1 FROM loan_installments li WHERE li."reconciledTransactionId"=t.id)) AS com_loan_li,
       count(*) FILTER (WHERE EXISTS(SELECT 1 FROM loan_installment_payments lip WHERE lip."transactionId"=t.id)) AS com_loan_lip
FROM transactions t
JOIN grp ON grp."bankAccountId"=t."bankAccountId" AND grp.date=t.date
        AND grp.amount=t.amount AND grp.type=t.type AND grp.description=t.description
WHERE t.lifecycle IN ('PAYABLE','RECEIVABLE');
