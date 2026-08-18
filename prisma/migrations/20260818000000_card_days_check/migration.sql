-- CARTAO FASE 1 C6 (18/08/2026) — closingDay/dueDay dentro de 1..31 e dueDay != closingDay.
-- Última barreira no banco (a app já valida 1..31 via Zod; o != é novo). 0 linhas
-- violam hoje (preview) → entra limpo. Postgres + SQLite (CHECK funciona nos dois).
-- ⚠️ ALTERs em tabela com DADOS REAIS: business_credit_cards (5 linhas) | ADD CONSTRAINT
--    CHECK | 0 violam | risco BAIXO | mitigação: preview confirmou 0 violações.
ALTER TABLE "business_credit_cards"
  ADD CONSTRAINT "chk_business_card_days"
  CHECK ("closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31 AND "dueDay" <> "closingDay");
