-- FASE 1 (read-only) — dimensionar movimento futuro tratado como real.
-- signed amount: CREDIT=+, DEBIT=-, TRANSFER=+/- por transferDirection.

\echo '################ 1.1 — TX com DTPOSTED > DTEND (periodEnd do import que a criou) ################'
\echo '# por empresa / banco / conta / lifecycle'
SELECT co.name AS empresa, ba."bankName" AS banco, ba.name AS conta,
       t.lifecycle, t.status, count(*) AS n,
       to_char(sum(CASE t.type WHEN 'CREDIT' THEN t.amount WHEN 'DEBIT' THEN -t.amount
                   WHEN 'TRANSFER' THEN (CASE t."transferDirection" WHEN 'IN' THEN t.amount WHEN 'OUT' THEN -t.amount ELSE 0 END)
                   ELSE 0 END),'FM999G999D00') AS soma_signed
FROM transactions t
JOIN ofx_imports oi ON oi.id=t."importId"
JOIN bank_accounts ba ON ba.id=t."bankAccountId"
JOIN companies co ON co.id=ba."companyId"
WHERE oi."periodEnd" IS NOT NULL AND t.date > oi."periodEnd"
GROUP BY co.name, ba."bankName", ba.name, t.lifecycle, t.status
ORDER BY co.name, ba.name, t.lifecycle;

\echo ''
\echo '################ 1.2 — QUAIS BANCOS mandam linha futura no OFX ################'
SELECT ba."bankName" AS banco, count(DISTINCT ba.id) AS contas_afetadas, count(*) AS tx_futuras
FROM transactions t
JOIN ofx_imports oi ON oi.id=t."importId"
JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE oi."periodEnd" IS NOT NULL AND t.date > oi."periodEnd" AND oi.source='OFX'
GROUP BY ba."bankName" ORDER BY tx_futuras DESC;

\echo ''
\echo '################ 1.4 — SALDO ERRADO por conta (agendado somado no anchor) ################'
\echo '# erro = soma dos signed de tx (date>ledgerBalDate) que NAO sao EFFECTED'
WITH pos AS (
  SELECT ba.id, ba.name AS conta, ba."bankName" AS banco, ba.balance AS saldo_armazenado,
         ba."ledgerBal", ba."ledgerBalDate",
         t.lifecycle,
         (CASE t.type WHEN 'CREDIT' THEN t.amount WHEN 'DEBIT' THEN -t.amount
              WHEN 'TRANSFER' THEN (CASE t."transferDirection" WHEN 'IN' THEN t.amount WHEN 'OUT' THEN -t.amount ELSE 0 END)
              ELSE 0 END) AS signed
  FROM bank_accounts ba
  JOIN transactions t ON t."bankAccountId"=ba.id
  WHERE ba."ledgerBalDate" IS NOT NULL AND t.date > ba."ledgerBalDate"
)
SELECT conta, banco,
       to_char(max("ledgerBal"),'FM999G999D00') AS ledgerbal_real,
       to_char(max(saldo_armazenado),'FM999G999D00') AS saldo_hoje,
       to_char(sum(signed) FILTER (WHERE lifecycle<>'EFFECTED'),'FM999G999D00') AS erro_agendado,
       to_char(max("ledgerBal") + coalesce(sum(signed) FILTER (WHERE lifecycle='EFFECTED'),0),'FM999G999D00') AS saldo_corrigido
FROM pos
GROUP BY conta, banco
HAVING sum(signed) FILTER (WHERE lifecycle<>'EFFECTED') <> 0
ORDER BY conta;

\echo ''
\echo '################ 1.x — as 4 futuras do Banrisul caçula (detalhe) ################'
SELECT to_char(t.date,'YYYY-MM-DD') AS data, t.amount, t."externalId" AS fitid, t.lifecycle, t.status,
       to_char(oi."periodEnd",'YYYY-MM-DD') AS dtend_import, left(t.id,10) AS tx_id, t.description
FROM transactions t JOIN ofx_imports oi ON oi.id=t."importId"
JOIN bank_accounts ba ON ba.id=t."bankAccountId"
WHERE ba."companyId"='cmq17yapb00gnrndlh33sctbo' AND ba."bankName" ILIKE '%banrisul%'
  AND t.date > oi."periodEnd"
ORDER BY t.date, t."externalId";
