-- CONTAGEM COM DIREÇÃO (lei v3, 23/11/2026) — zonas, item↔zona com ordem, grupo do item, ritmo
-- por grupo e a assinatura da zona/sessão. Autorização nominal do dono no sprint ("Migrations
-- ADITIVAS esperadas — só CREATE TABLE").
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de tabela nova. Nenhuma tabela existente é tocada.
-- ⛔ Nenhum dado pessoal de cliente. ⛔ Nenhuma linha nasce aqui: zonas, grupos e candidatos
-- são cliques do dono.

CREATE TABLE "stock_contagem_zona" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_contagem_zona_pkey" PRIMARY KEY ("id"),
    -- REGRA 13: IS NOT NULL explícito e primeiro
    CONSTRAINT "chk_stock_contagem_zona_nome" CHECK ("nome" IS NOT NULL AND length(trim("nome")) > 0)
);
CREATE UNIQUE INDEX "stock_contagem_zona_companyId_nome_key" ON "stock_contagem_zona"("companyId", "nome");
CREATE INDEX "stock_contagem_zona_companyId_idx" ON "stock_contagem_zona"("companyId");

CREATE TABLE "stock_contagem_zona_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "zonaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "definidoPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_contagem_zona_item_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_contagem_zona_item_companyId_itemId_key" ON "stock_contagem_zona_item"("companyId", "itemId");
CREATE INDEX "stock_contagem_zona_item_zonaId_ordem_idx" ON "stock_contagem_zona_item"("zonaId", "ordem");

CREATE TABLE "stock_item_grupo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "grupo" TEXT,
    "ignorado" BOOLEAN NOT NULL DEFAULT false,
    "definidoPorId" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_item_grupo_pkey" PRIMARY KEY ("id"),
    -- ⛔ REGRA 13: grupo NULL só quando o dono ignorou o candidato; senão A/B/C
    CONSTRAINT "chk_stock_item_grupo_valor" CHECK (("grupo" IS NULL AND "ignorado" = true) OR ("grupo" IS NOT NULL AND "grupo" IN ('A', 'B', 'C'))),
    CONSTRAINT "chk_stock_item_grupo_autor" CHECK ("definidoPorId" IS NOT NULL AND length(trim("definidoPorId")) > 0)
);
CREATE UNIQUE INDEX "stock_item_grupo_companyId_itemId_key" ON "stock_item_grupo"("companyId", "itemId");
CREATE INDEX "stock_item_grupo_companyId_idx" ON "stock_item_grupo"("companyId");

CREATE TABLE "stock_contagem_ritmo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "diasA" INTEGER NOT NULL,
    "diasB" INTEGER NOT NULL,
    "diasC" INTEGER NOT NULL,
    "definidoPorId" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_contagem_ritmo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_contagem_ritmo_dias" CHECK ("diasA" IS NOT NULL AND "diasB" IS NOT NULL AND "diasC" IS NOT NULL AND "diasA" BETWEEN 1 AND 366 AND "diasB" BETWEEN 1 AND 366 AND "diasC" BETWEEN 1 AND 366)
);
CREATE UNIQUE INDEX "stock_contagem_ritmo_companyId_key" ON "stock_contagem_ritmo"("companyId");

CREATE TABLE "stock_contagem_assinatura" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contagemId" TEXT NOT NULL,
    "zonaChave" TEXT NOT NULL,
    "zonaNome" TEXT NOT NULL,
    "assinadoPorNome" TEXT NOT NULL,
    "assinadoPorId" TEXT,
    "colaboradorId" TEXT,
    "viaPin" BOOLEAN NOT NULL DEFAULT false,
    "assinadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_contagem_assinatura_pkey" PRIMARY KEY ("id"),
    -- ⛔ assinatura sem nome é assinatura nenhuma (REGRA 13)
    CONSTRAINT "chk_stock_contagem_assinatura_nome" CHECK ("assinadoPorNome" IS NOT NULL AND length(trim("assinadoPorNome")) > 0),
    -- ⛔ via PIN exige o colaborador do PIN
    CONSTRAINT "chk_stock_contagem_assinatura_pin" CHECK ("viaPin" = false OR "colaboradorId" IS NOT NULL)
);
CREATE UNIQUE INDEX "stock_contagem_assinatura_contagemId_zonaChave_key" ON "stock_contagem_assinatura"("contagemId", "zonaChave");
CREATE INDEX "stock_contagem_assinatura_companyId_contagemId_idx" ON "stock_contagem_assinatura"("companyId", "contagemId");
