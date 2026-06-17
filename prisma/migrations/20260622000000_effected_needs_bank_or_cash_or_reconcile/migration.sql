-- Sprint Trava-Permanente (16/06/2026) — regra 5.
--
-- Bloqueia EFFECTED órfão silencioso (sem banco, sem cash-coding, sem
-- conciliação). Caso real: importador Excel criava EFFECTED com
-- bankAccountId=NULL quando a planilha tinha coluna "Pagamento" mas não tinha
-- "Conta" — esses lançamentos vazavam no Find & Match RAMO 2 como candidatos
-- pra qualquer OFX da empresa, confundindo o user.
--
-- Estado válido (≥1 condição):
--   (a) bankAccountId NOT NULL   — banco próprio
--   (b) cashCoded = true         — despesa em dinheiro físico
--   (c) reconciledWithId NOT NULL — par conciliado tem banco
--
-- TRANSFER fica fora (já tem suas próprias constraints transfer_*).
--
-- ⚠️ ALTERs em tabelas com DADOS REAIS
--
-- | Tabela       | Operação                       | Tipo               | Linhas afetadas | Risco | Mitigação |
-- |--------------|--------------------------------|--------------------|-----------------|-------|-----------|
-- | transactions | ADD CONSTRAINT CHECK           | Restritivo (novo)  | ~3000 vivas     | Baixo | Sprint Trava-Permanente já cash-codeou os 25 órfãos da Cacula. Globalmente: 669 EFFECTED+bankNull+!cashCoded existem mas TODOS têm reconciledWithId NOT NULL (conciliados via OFX-par) → passam pela regra (c). Constraint aplicada à frente. |
--
-- Verificação pré-migration (rode antes em prod):
--   SELECT COUNT(*) FROM transactions WHERE lifecycle = 'EFFECTED'
--     AND "bankAccountId" IS NULL AND "cashCoded" = false
--     AND "reconciledWithId" IS NULL AND type != 'TRANSFER';
-- Esperado: 0.

ALTER TABLE transactions
  ADD CONSTRAINT effected_needs_bank_or_cash_or_reconcile
  CHECK (
    lifecycle != 'EFFECTED'
    OR "bankAccountId" IS NOT NULL
    OR "cashCoded" = true
    OR "reconciledWithId" IS NOT NULL
    OR type = 'TRANSFER'
  );
