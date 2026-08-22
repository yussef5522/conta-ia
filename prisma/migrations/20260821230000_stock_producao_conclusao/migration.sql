-- ESTOQUE FASE 2 item 2.2 — conclusão da ordem ("quantos saíram?"). CREATE-only (isolamento).
CREATE TABLE "stock_producao_conclusao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ordemId" TEXT NOT NULL,
    "qtdGerada" DOUBLE PRECISION NOT NULL,
    "colaboradorId" TEXT,
    "escalaConsumida" DOUBLE PRECISION NOT NULL,
    "custoLoteReal" DOUBLE PRECISION NOT NULL,
    "custoUnitarioReal" DOUBLE PRECISION,
    "rendimento" DOUBLE PRECISION NOT NULL,
    "validadeAte" TIMESTAMP(3),
    "parcial" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_producao_conclusao_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_conclusao_qtd_gerada" CHECK ("qtdGerada" > 0)
);
CREATE INDEX "stock_producao_conclusao_companyId_ordemId_idx" ON "stock_producao_conclusao"("companyId", "ordemId");
