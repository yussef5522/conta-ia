-- ESTOQUE FASE 3 PARTE 2 — CONTAGEM. CREATE-only (isolamento: 0 ALTER/DROP, toda tabela
-- é stock_). CAMADA 1 (impossível por construção):
--   · 1 sessão ABERTA por company  → índice único PARCIAL (Postgres + SQLite ≥3.8)
--   · tipo/status só com valor do domínio → CHECK inline
--   · qtdContada >= 0 (contar negativo não existe) → CHECK inline
--   · 1 linha por item por sessão → UNIQUE(contagemId,itemId): contar 2× o mesmo item
--     na mesma sessão é impossível (a 2ª vira update da linha, nunca uma 2ª linha).
CREATE TABLE "stock_contagem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "observacao" TEXT,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_contagem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_contagem_tipo" CHECK ("tipo" IN ('INICIAL','ROTINA')),
    CONSTRAINT "chk_contagem_status" CHECK ("status" IN ('ABERTA','FINALIZADA','CANCELADA'))
);

CREATE TABLE "stock_contagem_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contagemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "saldoSistema" DOUBLE PRECISION NOT NULL,
    "qtdContada" DOUBLE PRECISION NOT NULL,
    "divergencia" DOUBLE PRECISION NOT NULL,
    "custoUnitario" DOUBLE PRECISION NOT NULL,
    "valorDivergencia" DOUBLE PRECISION NOT NULL,
    "movementId" TEXT,
    "freioConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "contadoPorId" TEXT,
    "contadoPorNome" TEXT,
    "contadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_contagem_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_contagem_item_qtd" CHECK ("qtdContada" >= 0)
);

CREATE INDEX "stock_contagem_companyId_status_idx" ON "stock_contagem"("companyId", "status");
CREATE INDEX "stock_contagem_companyId_iniciadaEm_idx" ON "stock_contagem"("companyId", "iniciadaEm");
CREATE UNIQUE INDEX "stock_contagem_item_contagemId_itemId_key" ON "stock_contagem_item"("contagemId", "itemId");
CREATE INDEX "stock_contagem_item_companyId_itemId_idx" ON "stock_contagem_item"("companyId", "itemId");

-- CAMADA 1: "uma sessão ABERTA por company". Duas contagens abertas ao mesmo tempo
-- deixariam dois contadores ajustando o mesmo item — o banco RECUSA.
CREATE UNIQUE INDEX "stock_contagem_one_open_per_company"
  ON "stock_contagem"("companyId") WHERE "status" = 'ABERTA';
