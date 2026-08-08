\set co '\'cmq17yapb00gnrndlh33sctbo\''

\echo '=== 1) SALDOS DAS CONTAS (caçula) ==='
SELECT name, balance, "ledgerBal", to_char("ledgerBalDate",'YYYY-MM-DD') AS ledger_date
FROM bank_accounts WHERE "companyId"=:co ORDER BY name;

\echo ''
\echo '=== 2) EMPRÉSTIMOS (esperado: 9) ==='
SELECT count(*) AS total_loans FROM loans WHERE "companyId"=:co;
\echo '--- por credor/contrato (Sicredi esperado: 4) ---'
SELECT lender, "contractNumber", "termMonths", carencia, "scheduleSource"
FROM loans WHERE "companyId"=:co ORDER BY lender, "contractNumber";

\echo ''
\echo '=== 3) DUPLICATAS ainda presentes (grupos com >1 mesma conta+data+valor+desc) ==='
SELECT count(*) AS grupos_dup, COALESCE(sum(cnt-1),0) AS copias_extras,
       to_char(COALESCE(sum((cnt-1)*amt),0),'FM999G999D00') AS valor_extra
FROM (
  SELECT t."bankAccountId", t.date, t.amount AS amt, t.description, count(*) AS cnt
  FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
  WHERE ba."companyId"=:co
  GROUP BY t."bankAccountId", t.date, t.amount, t.description
  HAVING count(*)>1
) x;

\echo ''
\echo '=== 4) PAR DE R$ 5.000 (TRANSFER — deve seguir 2 pernas) ==='
SELECT type, "transferDirection", count(*) FROM transactions t
JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"=:co AND t.amount=5000 AND t.type='TRANSFER'
GROUP BY type, "transferDirection" ORDER BY "transferDirection";

\echo ''
\echo '=== 5) VÍNCULOS de parcela de empréstimo (installments com tx) ==='
SELECT count(*) AS parcelas_vinculadas
FROM loan_installments li JOIN loans l ON l.id=li."loanId"
WHERE l."companyId"=:co AND li."reconciledTransactionId" IS NOT NULL;
\echo '--- pontes N:1 loan_installment_payments ---'
SELECT count(*) AS ponte_pagamentos FROM loan_installment_payments lip
JOIN loan_installments li ON li.id=lip."installmentId"
JOIN loans l ON l.id=li."loanId" WHERE l."companyId"=:co;

\echo ''
\echo '=== 6) TOTAL de transações da caçula (baseline) ==='
SELECT count(*) AS total_tx FROM transactions t
JOIN bank_accounts ba ON ba.id=t."bankAccountId" WHERE ba."companyId"=:co;
