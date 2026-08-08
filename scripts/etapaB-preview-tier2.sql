\set co '\'cmq17yapb00gnrndlh33sctbo\''

\echo '################ TIER 2 — EFFECTED↔EFFECTED (mesma conta/data/valor/tipo/desc) ################'
\echo '# DISCRIMINADOR: FITIDs distintos no grupo = linhas REAIS diferentes (MANTER).'
\echo '#               1 FITID p/ N cópias = mesma linha reimportada (duplicata → remover N-1).'
\echo ''
WITH grp AS (
  SELECT t."bankAccountId", t.date, t.amount, t.type, t.description
  FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
  WHERE ba."companyId"=:co AND t.type IN ('CREDIT','DEBIT')
  GROUP BY t."bankAccountId", t.date, t.amount, t.type, t.description
  HAVING count(*) FILTER (WHERE t.lifecycle='EFFECTED')>1
)
SELECT ba.name AS conta, to_char(t.date,'MM-DD') AS dia, t.amount AS valor, t.type,
       count(*) AS copias,
       count(DISTINCT coalesce(t."externalId",t.id)) AS fitids_distintos,
       count(*) - count(DISTINCT coalesce(t."externalId",t.id)) AS dup_reais,
       string_agg(DISTINCT coalesce(t."externalId",'(null)'), ' , ') AS fitids,
       left(max(t.description),40) AS desc
FROM transactions t
JOIN bank_accounts ba ON ba.id=t."bankAccountId"
JOIN grp ON grp."bankAccountId"=t."bankAccountId" AND grp.date=t.date
        AND grp.amount=t.amount AND grp.type=t.type AND grp.description=t.description
WHERE t.lifecycle='EFFECTED'
GROUP BY ba.name, t.date, t.amount, t.type, t.description
ORDER BY ba.name, t.date, t.amount;

\echo ''
\echo '################ TIER 3 — o caso 70,02 (todas as cópias, qualquer status/lifecycle) ################'
SELECT ba.name AS conta, to_char(t.date,'YYYY-MM-DD') AS data, t.amount, t.type,
       t.lifecycle, t.status, left(t.id,10) AS tx_id,
       coalesce(t."externalId",'(null)') AS fitid, to_char(t."createdAt",'MM-DD HH24:MI') AS criada,
       t.description AS desc_completa
FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"=:co AND t.amount=70.02
ORDER BY t.date, t.id;

\echo ''
\echo '################ TIER 4 — par de transferência R$ 5.000 (V1 vs V2) ################'
SELECT ba.name AS conta, to_char(t.date,'YYYY-MM-DD') AS data, t.type, t."transferDirection" AS dir,
       t."transferGroupId" AS grupo, left(t.id,12) AS tx_id, t.origin,
       to_char(t."createdAt",'MM-DD HH24:MI') AS criada, left(coalesce(t.description,''),30) AS desc
FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"=:co AND t.amount=5000 AND t.type='TRANSFER'
ORDER BY t."transferGroupId", t."transferDirection";
