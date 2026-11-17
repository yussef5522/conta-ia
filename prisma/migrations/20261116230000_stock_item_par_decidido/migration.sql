-- A DECISÃO DO DONO SOBRE UM PAR DE ITENS PARECIDOS (16/11/2026) — fila de casamento assistido.
-- Autorização nominal do dono no sprint ("Migration só ADITIVA se precisar — CREATE only").
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de tabela nova. Nenhuma tabela existente é tocada.
-- ⛔ Nenhum dado pessoal de cliente.
CREATE TABLE "stock_item_par_decidido" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemAId" TEXT NOT NULL,
    "itemBId" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "decididoPorId" TEXT NOT NULL,
    "decididoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_item_par_decidido_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_item_par_decisao" CHECK ("decisao" IN ('DIFERENTES', 'JUNTADOS')),
    -- ⛔ par ORDENADO (byte a byte, COLLATE "C" = a ordem do JS): o mesmo par nunca vira duas linhas
    CONSTRAINT "chk_stock_item_par_ordem" CHECK ("itemAId" IS NOT NULL AND "itemBId" IS NOT NULL AND "itemAId" COLLATE "C" < "itemBId" COLLATE "C"),
    -- ⛔ decisão sem autor é impossível (REGRA 13: IS NOT NULL explícito e primeiro)
    CONSTRAINT "chk_stock_item_par_autor" CHECK ("decididoPorId" IS NOT NULL AND length(trim("decididoPorId")) > 0)
);
CREATE UNIQUE INDEX "stock_item_par_decidido_companyId_itemAId_itemBId_key" ON "stock_item_par_decidido"("companyId", "itemAId", "itemBId");
CREATE INDEX "stock_item_par_decidido_companyId_idx" ON "stock_item_par_decidido"("companyId");
