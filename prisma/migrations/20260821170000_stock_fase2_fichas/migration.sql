-- ESTOQUE FASE 2 item 2.0 — produção: setor + colaborador + ficha técnica versionada.
-- CREATE-only (isolamento: nenhuma tabela existente é tocada; só stock_).

CREATE TABLE "stock_setor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_setor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_setor_companyId_ativo_idx" ON "stock_setor"("companyId", "ativo");
CREATE UNIQUE INDEX "stock_setor_companyId_nome_key" ON "stock_setor"("companyId", "nome");

CREATE TABLE "stock_colaborador" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_colaborador_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_colaborador_companyId_ativo_idx" ON "stock_colaborador"("companyId", "ativo");

CREATE TABLE "stock_ficha" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemProduzidoId" TEXT NOT NULL,
    "tipoProduto" TEXT NOT NULL,
    "setorId" TEXT,
    "versaoAtual" INTEGER NOT NULL DEFAULT 1,
    "valorVenda" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_ficha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_ficha_companyId_ativo_idx" ON "stock_ficha"("companyId", "ativo");
CREATE UNIQUE INDEX "stock_ficha_companyId_itemProduzidoId_key" ON "stock_ficha"("companyId", "itemProduzidoId");

CREATE TABLE "stock_ficha_versao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "loteBase" DOUBLE PRECISION NOT NULL,
    "unidadeLoteBase" TEXT NOT NULL,
    "modoPreparo" TEXT,
    "tempoPreparoMin" INTEGER,
    "validadeDias" INTEGER,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_ficha_versao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_ficha_versao_companyId_fichaId_idx" ON "stock_ficha_versao"("companyId", "fichaId");
CREATE UNIQUE INDEX "stock_ficha_versao_companyId_fichaId_versao_key" ON "stock_ficha_versao"("companyId", "fichaId", "versao");

CREATE TABLE "stock_ficha_componente" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtdPlanejada" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "stock_ficha_componente_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_ficha_componente_companyId_versaoId_idx" ON "stock_ficha_componente"("companyId", "versaoId");
