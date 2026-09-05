-- ⭐⭐ O RASTRO DA UNIDADE CORRIGIDA (05/09/2026).
--
-- A nota do ALAN dizia "12 KG" de leite em pó; eram 12 LATAS de 400g. A NOTA fica como
-- veio (é fato assinado pela SEFAZ) — o que se registra aqui é a ENTRADA que o dono
-- conferiu, com quem e quando.
--
-- ⛔ TABELA NOVA, e não uma coluna em `stock_conference_item`, porque migration de estoque
-- é CREATE-only (guard de CI). E é a decisão certa por conteúdo também: correção de
-- unidade é um FATO PRÓPRIO, com autor e data, não um atributo da linha conferida.
--
-- ⭐ É daqui que sai o APRENDIZADO: da próxima vez que o mesmo (fornecedor, cProd) vier na
-- unidade errada, a tela sugere "da última vez você conferiu como UN". SUGERE — pode ser
-- que um dia venha a granel de verdade.
CREATE TABLE "stock_unidade_corrigida" (
  "id"              TEXT PRIMARY KEY,
  "companyId"       TEXT NOT NULL,
  "supplierCnpj"    TEXT,
  "cProd"           TEXT,
  "nfeItemId"       TEXT,
  "conferenceId"    TEXT,
  "itemId"          TEXT,
  -- o que a NOTA declarou (nunca se reescreve o documento)
  "unidadeNota"     TEXT NOT NULL,
  "qtdNota"         DOUBLE PRECISION NOT NULL,
  -- o que o DONO conferiu
  "unidadeEntrada"  TEXT NOT NULL,
  "qtdEntrada"      DOUBLE PRECISION NOT NULL,
  "fatorConversao"  DOUBLE PRECISION NOT NULL DEFAULT 1,
  "corrigidoPorId"  TEXT,
  "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ⛔ correção que não corrige nada não existe: se as unidades são iguais, não é correção
  CONSTRAINT "chk_unidade_corrigida_difere" CHECK ("unidadeNota" <> "unidadeEntrada"),
  CONSTRAINT "chk_unidade_corrigida_qtd" CHECK ("qtdEntrada" > 0 AND "qtdNota" > 0),
  CONSTRAINT "chk_unidade_corrigida_fator" CHECK ("fatorConversao" > 0)
);

-- a busca do aprendizado: "o que este fornecedor mandou neste cProd da última vez?"
CREATE INDEX "stock_unidade_corrigida_fornecedor_idx"
  ON "stock_unidade_corrigida" ("companyId", "supplierCnpj", "cProd", "criadoEm");
CREATE INDEX "stock_unidade_corrigida_company_idx"
  ON "stock_unidade_corrigida" ("companyId", "criadoEm");
