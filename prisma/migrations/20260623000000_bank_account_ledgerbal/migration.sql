-- Sprint Saldo-Ancorado-LEDGERBAL (17/06/2026).
--
-- Adiciona ledgerBal + ledgerBalDate em bank_accounts pra ancorar o saldo
-- no que o extrato OFX diz (DTASOF + BALAMT), em vez do increment cumulativo
-- que driftou (caso real Cacula: sistema +R$ 92k vs LEDGERBAL real -R$ 37,5k).
--
-- Regra do balance pós-sprint:
--   COM extrato:  balance = ledgerBal + SUM(signed tx WHERE date > ledgerBalDate)
--   SEM extrato:  balance = SUM(signed tx) (caixa físico, manual)
--
-- ⚠️ ALTERs em tabelas com DADOS REAIS
--
-- | Tabela        | Operação                          | Tipo               | Linhas afetadas | Risco | Mitigação |
-- |---------------|-----------------------------------|--------------------|-----------------|-------|-----------|
-- | bank_accounts | ADD COLUMN "ledgerBal" Float?      | Aditivo nullable   | ~30             | Zero  | Sem default; nenhum trigger; balance segue intacto até FASE 4 popular |
-- | bank_accounts | ADD COLUMN "ledgerBalDate" Date?   | Aditivo nullable   | ~30             | Zero  | Idem |
--
-- FASE 4 (script separado, gated) popula esses campos pras contas da Cacula
-- com os LEDGERBAL reais do extrato (-8030,99 / +838,30 / -30318,60) e roda
-- recalcularSaldo() pra corrigir o drift sem perder histórico de tx.

ALTER TABLE "bank_accounts" ADD COLUMN "ledgerBal" DOUBLE PRECISION;
ALTER TABLE "bank_accounts" ADD COLUMN "ledgerBalDate" TIMESTAMP(3);
