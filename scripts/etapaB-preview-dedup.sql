\set co '\'cmq17yapb00gnrndlh33sctbo\''

\echo '################ TIER 1 — grupos PREVIEW↔REAL (o alvo do bug) ################'
\echo '# grupo = mesma conta+data+valor+tipo+desc com >=1 EFFECTED e >=1 PAYABLE/RECEIVABLE'
\echo ''
\echo '--- resumo por conta ---'
WITH g AS (
  SELECT t."bankAccountId", ba.name AS conta, t.date, t.amount, t.type, t.description,
         count(*) AS cnt,
         count(*) FILTER (WHERE t.lifecycle='EFFECTED') AS n_eff,
         count(*) FILTER (WHERE t.lifecycle IN ('PAYABLE','RECEIVABLE')) AS n_prev
  FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
  WHERE ba."companyId"=:co
  GROUP BY t."bankAccountId", ba.name, t.date, t.amount, t.type, t.description
  HAVING count(*)>1 AND count(*) FILTER (WHERE t.lifecycle='EFFECTED')>=1
     AND count(*) FILTER (WHERE t.lifecycle IN ('PAYABLE','RECEIVABLE'))>=1
)
SELECT conta, count(*) AS grupos, sum(n_prev) AS previews_a_remover,
       to_char(sum(n_prev*amount),'FM999G999D00') AS valor_previews
FROM g GROUP BY conta ORDER BY conta;

\echo ''
\echo '--- detalhe linha a linha (preview = candidata a SAIR; effected = FICA) ---'
WITH grp AS (
  SELECT t."bankAccountId", t.date, t.amount, t.type, t.description
  FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
  WHERE ba."companyId"=:co
  GROUP BY t."bankAccountId", t.date, t.amount, t.type, t.description
  HAVING count(*)>1 AND count(*) FILTER (WHERE t.lifecycle='EFFECTED')>=1
     AND count(*) FILTER (WHERE t.lifecycle IN ('PAYABLE','RECEIVABLE'))>=1
)
SELECT ba.name AS conta, to_char(t.date,'MM-DD') AS dia, t.amount AS valor, t.type,
       t.lifecycle, t.status,
       CASE WHEN t.lifecycle='EFFECTED' THEN 'FICA' ELSE 'sai?' END AS acao,
       left(t.id,10) AS tx_id, left(coalesce(t."importId",'-'),8) AS import,
       coalesce(t."externalId",'-') AS fitid,
       to_char(t."createdAt",'MM-DD HH24:MI') AS criada,
       CASE WHEN t."reconcileGroupId" IS NOT NULL OR t."reconciledWithId" IS NOT NULL THEN 'CONCIL' ELSE '' END AS concil,
       left(coalesce(t.description,''),34) AS desc
FROM transactions t
JOIN bank_accounts ba ON ba.id=t."bankAccountId"
JOIN grp ON grp."bankAccountId"=t."bankAccountId" AND grp.date=t.date
        AND grp.amount=t.amount AND grp.type=t.type AND grp.description=t.description
ORDER BY ba.name, t.date, t.amount, t.lifecycle DESC;
