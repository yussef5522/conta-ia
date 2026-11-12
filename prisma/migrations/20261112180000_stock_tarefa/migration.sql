-- TAREFA — TIPO PRÓPRIO (lei v7 M2, 12/11/2026). Autorização nominal do dono no sprint.
--
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de tabela nova. Nenhuma tabela existente é tocada,
-- nenhuma coluna alterada, nenhum backfill — não há seção de ALTERs em dado real.
-- ⛔ Nenhum dado pessoal de cliente.
CREATE TABLE "stock_tarefa" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "instrucao" TEXT,
    "dia" TIMESTAMP(3) NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaEm" TIMESTAMP(3),
    "canceladaPorId" TEXT,
    CONSTRAINT "stock_tarefa_pkey" PRIMARY KEY ("id"),
    -- ⛔ nome vazio é impossível no banco (REGRA 13: IS NOT NULL explícito e primeiro)
    CONSTRAINT "chk_stock_tarefa_nome" CHECK ("nome" IS NOT NULL AND length(trim("nome")) > 0),
    -- ⛔ cancelar sem autor/instante pela metade é impossível
    CONSTRAINT "chk_stock_tarefa_cancelada" CHECK (("canceladaEm" IS NULL) = ("canceladaPorId" IS NULL))
);
CREATE INDEX "stock_tarefa_companyId_dia_idx" ON "stock_tarefa"("companyId", "dia");
