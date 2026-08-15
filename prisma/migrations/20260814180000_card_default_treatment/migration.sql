-- Sprint Cartao-Uso-Pessoal (14/08/2026): tratamento padrao das compras do cartao.
-- 100% ADITIVA — defaultTreatment com DEFAULT (linhas existentes viram OPERACIONAL,
-- = comportamento atual, zero mudanca), socioPFId nullable. Sem backfill.
--
-- ⚠️ ALTER em tabela com DADOS REAIS — business_credit_cards (~5 linhas):
--   | coluna           | operacao                 | tipo | risco | mitigacao
--   | defaultTreatment | ADD COLUMN default 'OPER'| TEXT | nulo  | default preserva comportamento
--   | socioPFId        | ADD COLUMN nullable      | TEXT | nulo  | aditiva pura
ALTER TABLE "business_credit_cards" ADD COLUMN "defaultTreatment" TEXT NOT NULL DEFAULT 'OPERACIONAL';
ALTER TABLE "business_credit_cards" ADD COLUMN "socioPFId" TEXT;
