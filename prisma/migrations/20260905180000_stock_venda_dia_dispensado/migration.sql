-- ⭐⭐ O DIA QUE O DONO DECIDIU NÃO BAIXAR (05/09/2026).
--
-- Decisão dele: as baixas começam de 04/09 pra frente. Em 02 e 03/09 a produção ainda não
-- estava montada, e baixar ali só criaria negativo sem significado.
--
-- ⛔ SEM ESTE ESTADO, o aviso de "importado sem baixar" gritaria PARA SEMPRE sobre dias que
-- ele pulou de propósito — e **alarme falso repetido mata o alarme** (a lição dos 111 falsos
-- do juiz de vendas). Pular por decisão não é pendência.
--
-- ⚠️ REVERSÍVEL e com AUTOR: dispensar é decisão, e decisão tem dono e data. Reverter não
-- apaga a linha — carimba `revertidoEm`, e o rastro fica nos dois sentidos (o mesmo desenho
-- da recusa de nota).
CREATE TABLE "stock_venda_dia_dispensado" (
  "id"             TEXT PRIMARY KEY,
  "companyId"      TEXT NOT NULL,
  -- COMPLEMENTO (relatório de complementos) | PRODUTO (relatório de produtos do PDV)
  "escopo"         TEXT NOT NULL,
  "data"           TIMESTAMP(3) NOT NULL,
  "importId"       TEXT,
  "motivo"         TEXT,
  "dispensadoPorId" TEXT,
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revertidoEm"    TIMESTAMP(3),
  "revertidoPorId" TEXT,
  CONSTRAINT "chk_dispensado_escopo" CHECK ("escopo" IN ('COMPLEMENTO', 'PRODUTO'))
);

-- ⛔ UMA dispensa ATIVA por (empresa, escopo, dia) — dispensar duas vezes é impossível por
-- construção, não "checado" (índice parcial, o mesmo padrão da recusa de nota).
CREATE UNIQUE INDEX "stock_venda_dia_dispensado_ativo_uniq"
  ON "stock_venda_dia_dispensado" ("companyId", "escopo", "data")
  WHERE "revertidoEm" IS NULL;

CREATE INDEX "stock_venda_dia_dispensado_company_idx"
  ON "stock_venda_dia_dispensado" ("companyId", "escopo", "criadoEm");
