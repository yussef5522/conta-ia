-- ESTOQUE FASE 2 item 2.1 — ordem de produção (5 estados). CREATE-only (isolamento).
-- CHECK de estado inline (CAMADA 1: estado inválido é impossível no banco).
CREATE TABLE "stock_production_order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "versaoFicha" INTEGER NOT NULL,
    "itemProduzidoId" TEXT NOT NULL,
    "setorId" TEXT,
    "colaboradorId" TEXT,
    "dataProducao" TIMESTAMP(3) NOT NULL,
    "escalaReceitas" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "estado" TEXT NOT NULL DEFAULT 'PLANEJADA',
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_production_order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_production_order_estado" CHECK ("estado" IN ('PLANEJADA','SEPARADA','EM_PRODUCAO','CONCLUIDA','CANCELADA')),
    CONSTRAINT "chk_production_order_escala" CHECK ("escalaReceitas" > 0)
);
CREATE INDEX "stock_production_order_companyId_estado_idx" ON "stock_production_order"("companyId", "estado");
CREATE INDEX "stock_production_order_companyId_dataProducao_idx" ON "stock_production_order"("companyId", "dataProducao");
