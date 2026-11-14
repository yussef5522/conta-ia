-- RECEITA EXCLUÍDA COM HISTÓRIA (lei R24 da RECEITAS v2, 13/11/2026). Autorização nominal do dono no sprint.
--
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de tabela nova. Nenhuma tabela existente é tocada
-- (a regra do módulo: migration de estoque SÓ CRIA — lib/stock/__tests__/migration-isolation).
-- ⭐ Receita com lotes, quando excluída, ganha UMA linha aqui (e `stock_ficha.ativo` = false):
-- some do catálogo, da busca e da criação de ordem; o registro vive por dentro pros lotes
-- antigos e o custo histórico não quebrarem. "Desativada" (sazonal) é ativo=false SEM linha aqui.
-- ⛔ Nenhum dado pessoal de cliente.
CREATE TABLE "stock_ficha_excluida" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "lotesNaHistoria" INTEGER NOT NULL,
    "excluidaPorId" TEXT,
    "excluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_ficha_excluida_pkey" PRIMARY KEY ("id"),
    -- ⛔ "excluída com história" sem história é a outra régua (apaga de vez) — impossível aqui
    CONSTRAINT "chk_stock_ficha_excluida_lotes" CHECK ("lotesNaHistoria" IS NOT NULL AND "lotesNaHistoria" > 0)
);
CREATE UNIQUE INDEX "stock_ficha_excluida_fichaId_key" ON "stock_ficha_excluida"("fichaId");
CREATE INDEX "stock_ficha_excluida_companyId_idx" ON "stock_ficha_excluida"("companyId");
