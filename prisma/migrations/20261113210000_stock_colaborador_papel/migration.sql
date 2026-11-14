-- PAPEL DA CONTA DA EQUIPE (leis R20/R13 da EQUIPE v2, 13/11/2026). Autorização nominal do dono no sprint.
--
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de tabela nova. Nenhuma tabela existente é tocada
-- (a regra do módulo: migration de estoque SÓ CRIA — lib/stock/__tests__/migration-isolation).
-- ⭐ Conta SEM linha aqui é COZINHA (o papel de todo mundo até hoje). A linha só nasce quando o
-- dono escolhe outro papel ou cria a conta já com papel. 1 linha por conta (índice único).
-- ⛔ Nenhum dado pessoal de cliente.
CREATE TABLE "stock_colaborador_papel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "definidoPorId" TEXT,
    "definidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_colaborador_papel_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_colaborador_papel" CHECK ("papel" IN ('COZINHA','ESCRITORIO','APARELHO'))
);
CREATE UNIQUE INDEX "stock_colaborador_papel_colaboradorId_key" ON "stock_colaborador_papel"("colaboradorId");
CREATE INDEX "stock_colaborador_papel_companyId_idx" ON "stock_colaborador_papel"("companyId");
