-- ⭐ GRUPO DO COMPLEMENTO (sabor de pizza × outro) — OVERRIDE do dono, 02/09/2026.
--
-- ⚠️ SÓ GUARDA O QUE O DONO MOVEU. A régua padrão é a lista do cardápio, que vive em
-- `lib/stock/vendas/grupo-complemento.ts` — cardápio novo se resolve editando código, sem
-- backfill de linha nenhuma. Por isso a tabela nasce vazia e assim continua na maior parte.
--
-- ⛔ CREATE-only (isolamento do módulo, guard de CI): não toca nenhuma tabela existente.
-- ROLLBACK: DROP TABLE "stock_venda_complemento_grupo";
CREATE TABLE "stock_venda_complemento_grupo" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "companyId"     TEXT NOT NULL,
  "nomeSuitable"  TEXT NOT NULL,
  "grupo"         TEXT NOT NULL,
  "criadoPorId"   TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ⭐ CAMADA 1: grupo inventado é impossível no banco, não "checado no app"
  CONSTRAINT "chk_complemento_grupo" CHECK ("grupo" IN ('SABOR','OUTRO')),
  CONSTRAINT "chk_complemento_grupo_nome" CHECK (length(trim("nomeSuitable")) > 0)
);

-- um grupo por nome, por empresa: mover é UPDATE, nunca uma 2ª linha discordando
CREATE UNIQUE INDEX "stock_venda_complemento_grupo_company_nome_key"
  ON "stock_venda_complemento_grupo" ("companyId", "nomeSuitable");
CREATE INDEX "stock_venda_complemento_grupo_companyId_idx"
  ON "stock_venda_complemento_grupo" ("companyId");
