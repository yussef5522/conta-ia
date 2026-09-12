-- ⭐ O RASTRO DA TROCA DE CATEGORIA (12/09/2026) — CREATE-only, como toda migration de estoque.
--
-- "com rastro de quem/quando trocou" — o dono. Tabela própria e não uma coluna em
-- `stock_item`: a troca tem AUTOR e DATA, e é um FATO por si (o item pode trocar de
-- categoria mais de uma vez).
--
-- ROLLBACK: DROP TABLE "stock_item_categoria_trocada";
CREATE TABLE "stock_item_categoria_trocada" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "itemId"       TEXT NOT NULL,
  "de"           TEXT NOT NULL,
  "para"         TEXT NOT NULL,
  "trocadoPorId" TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_categoria_trocada_pkey" PRIMARY KEY ("id"),
  -- ⛔ troca que não troca nada não é um fato
  CONSTRAINT "chk_categoria_mudou" CHECK ("de" <> "para")
);
CREATE INDEX "stock_item_categoria_trocada_item_idx" ON "stock_item_categoria_trocada"("companyId", "itemId");
