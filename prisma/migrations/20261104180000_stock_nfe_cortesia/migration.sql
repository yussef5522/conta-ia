-- CORTESIA/BONIFICAÇÃO (04/11/2026) — marca a nota cuja mercadoria entra SEM cobrança.
--
-- 100% ADITIVA PURA: CREATE TABLE de tabela nova. Nenhuma tabela existente é tocada,
-- nenhuma coluna alterada, nenhum backfill. Por isso não há seção de "ALTERs em tabelas
-- com DADOS REAIS" — não existe ALTER aqui.
CREATE TABLE "stock_nfe_cortesia" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "motivo" TEXT,
    "marcadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marcadaPorId" TEXT,

    CONSTRAINT "stock_nfe_cortesia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_nfe_cortesia_companyId_idx" ON "stock_nfe_cortesia"("companyId");
-- uma marca por nota: a cortesia é um fato da nota, não um log de tentativas
CREATE UNIQUE INDEX "stock_nfe_cortesia_companyId_nfeId_key" ON "stock_nfe_cortesia"("companyId", "nfeId");
