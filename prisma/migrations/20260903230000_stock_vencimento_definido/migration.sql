-- ⭐ RASTRO DO VENCIMENTO DEFINIDO PELO DONO (03/09/2026).
--
-- ⚠️ POR QUE TABELA NOVA e não uma coluna em `stock_payable_suggestion`: migration de
-- estoque é CREATE-only (guard de CI barra ALTER). E o rastro é um EVENTO, não um estado —
-- ele guarda o que a data ERA, o que virou, quem decidiu e por quê.
--
-- ⭐ A REGRA QUE ISTO MATERIALIZA: **a nota é FATO imutável; o vencimento é COMBINADO.**
-- Combinado se muda, com rastro. Nota, não. (A mesma separação de 29/08 entre
-- `stock_nfe_dup` e `stock_parcela_combinada`.)
--
-- ROLLBACK: DROP TABLE "stock_vencimento_definido";
CREATE TABLE "stock_vencimento_definido" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "companyId"     TEXT NOT NULL,
  "suggestionId"  TEXT NOT NULL,
  "dVencAnterior" TIMESTAMP(3),
  "dVencNovo"     TIMESTAMP(3) NOT NULL,
  -- DONO = o dono combinou com o fornecedor · BOLETO = chegou o documento com a data
  "origem"        TEXT NOT NULL,
  "criadoPorId"   TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_vencimento_origem" CHECK ("origem" IN ('DONO','BOLETO'))
);

CREATE INDEX "stock_vencimento_definido_companyId_idx" ON "stock_vencimento_definido" ("companyId");
CREATE INDEX "stock_vencimento_definido_suggestion_idx" ON "stock_vencimento_definido" ("companyId", "suggestionId");
