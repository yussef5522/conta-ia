-- ⭐ as seções do cardápio + a seção de cada produto. CREATE-only.
CREATE TABLE "stock_cardapio_secao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 50,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_cardapio_secao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_cardapio_secao_companyId_chave_key" ON "stock_cardapio_secao"("companyId", "chave");
CREATE INDEX "stock_cardapio_secao_companyId_ordem_idx" ON "stock_cardapio_secao"("companyId", "ordem");

CREATE TABLE "stock_cardapio_produto_secao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "secao" TEXT NOT NULL,
    "sugerida" BOOLEAN NOT NULL DEFAULT true,
    "porQue" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_cardapio_produto_secao_pkey" PRIMARY KEY ("id")
);
-- ⛔ um nome do PDV, uma seção: gravar duas vezes é impossível, não "checado"
CREATE UNIQUE INDEX "stock_cardapio_produto_secao_companyId_nomeSuitable_key" ON "stock_cardapio_produto_secao"("companyId", "nomeSuitable");
CREATE INDEX "stock_cardapio_produto_secao_companyId_secao_idx" ON "stock_cardapio_produto_secao"("companyId", "secao");
