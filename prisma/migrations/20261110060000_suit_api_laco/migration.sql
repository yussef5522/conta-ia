-- SUITAPI — O LAÇO (10/11/2026): a API da Suit vira a fonte oficial das vendas de PRODUTOS.
--
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de tabelas novas. Nenhuma tabela existente é
-- tocada, nenhuma coluna alterada, nenhum backfill — não há seção de ALTERs em dado real.
-- ⛔ Nenhuma coluna de dado pessoal de cliente (LGPD / lei V8).
-- CreateTable
CREATE TABLE "suit_pedido" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiId" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderType" TEXT,
    "source" TEXT,
    "displayNumber" TEXT,
    "integrationCode" TEXT,
    "criadoApiEm" TIMESTAMP(3) NOT NULL,
    "entregueApiEm" TIMESTAMP(3),
    "finalizadoApiEm" TIMESTAMP(3),
    "agendadoPara" TIMESTAMP(3),
    "agendado" BOOLEAN NOT NULL DEFAULT false,
    "produtosCent" INTEGER NOT NULL,
    "entregaCent" INTEGER NOT NULL,
    "servicoCent" INTEGER NOT NULL,
    "descontoCent" INTEGER NOT NULL,
    "adicionalCent" INTEGER NOT NULL,
    "totalCent" INTEGER NOT NULL,
    "pago" BOOLEAN NOT NULL,
    "impressao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "vistoPrimeiroEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vistoUltimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sumidoEm" TIMESTAMP(3),

    CONSTRAINT "suit_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suit_pedido_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "apiItemId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unitarioCent" INTEGER NOT NULL,
    "precoCent" INTEGER NOT NULL,
    "baseCent" INTEGER,
    "status" TEXT,
    "pedidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "pesoKg" DOUBLE PRECISION,
    "porPeso" BOOLEAN NOT NULL DEFAULT false,
    "promocional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "suit_pedido_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suit_item_opcao" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "grupo" TEXT,
    "nome" TEXT NOT NULL,
    "unitarioCent" INTEGER NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "precoCent" INTEGER NOT NULL,

    CONSTRAINT "suit_item_opcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suit_pedido_pagamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "apiMetodoId" INTEGER,
    "codigo" INTEGER,
    "tipo" TEXT,
    "lancamento" TEXT,
    "valorCent" INTEGER NOT NULL,
    "liquidado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "suit_pedido_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suit_pagamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiId" INTEGER NOT NULL,
    "entryId" INTEGER,
    "diaCaixa" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "receita" BOOLEAN NOT NULL,
    "administrativo" BOOLEAN NOT NULL,
    "conciliado" BOOLEAN NOT NULL,
    "valorCent" INTEGER NOT NULL,
    "taxaCent" INTEGER NOT NULL,
    "liquidoCent" INTEGER NOT NULL,
    "metodoTipo" TEXT,
    "metodoApiId" INTEGER,
    "contaApiId" INTEGER,
    "billId" INTEGER,
    "caixaId" INTEGER,
    "turnoCaixaId" INTEGER,
    "criadoApiEm" TIMESTAMP(3) NOT NULL,
    "recebidoEm" TEXT,
    "vistoUltimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suit_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suit_pedido_evento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "apiId" INTEGER NOT NULL,
    "dia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressaoAntes" TEXT NOT NULL,
    "impressaoDepois" TEXT,
    "deltaCent" INTEGER NOT NULL,
    "deltaUn" DOUBLE PRECISION NOT NULL,
    "depoisDaMaterializacao" BOOLEAN NOT NULL,
    "decisao" TEXT,
    "decididoEm" TIMESTAMP(3),
    "decididoPorId" TEXT,

    CONSTRAINT "suit_pedido_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suit_dia_materializado" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "importId" TEXT,
    "pedidos" INTEGER NOT NULL,
    "linhas" INTEGER NOT NULL,
    "unidades" DOUBLE PRECISION NOT NULL,
    "totalCent" INTEGER NOT NULL,
    "motivo" TEXT,
    "materializadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suit_dia_materializado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suit_pedido_companyId_dia_idx" ON "suit_pedido"("companyId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "suit_pedido_companyId_apiId_key" ON "suit_pedido"("companyId", "apiId");

-- CreateIndex
CREATE INDEX "suit_pedido_item_companyId_pedidoId_idx" ON "suit_pedido_item"("companyId", "pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "suit_pedido_item_pedidoId_apiItemId_key" ON "suit_pedido_item"("pedidoId", "apiItemId");

-- CreateIndex
CREATE INDEX "suit_item_opcao_itemId_idx" ON "suit_item_opcao"("itemId");

-- CreateIndex
CREATE INDEX "suit_pedido_pagamento_companyId_pedidoId_idx" ON "suit_pedido_pagamento"("companyId", "pedidoId");

-- CreateIndex
CREATE INDEX "suit_pagamento_companyId_dia_idx" ON "suit_pagamento"("companyId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "suit_pagamento_companyId_apiId_key" ON "suit_pagamento"("companyId", "apiId");

-- CreateIndex
CREATE INDEX "suit_pedido_evento_companyId_dia_idx" ON "suit_pedido_evento"("companyId", "dia");

-- CreateIndex
CREATE INDEX "suit_pedido_evento_companyId_decisao_idx" ON "suit_pedido_evento"("companyId", "decisao");

-- CreateIndex
CREATE UNIQUE INDEX "suit_dia_materializado_companyId_dia_key" ON "suit_dia_materializado"("companyId", "dia");

-- AddForeignKey
ALTER TABLE "suit_pedido_item" ADD CONSTRAINT "suit_pedido_item_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "suit_pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suit_item_opcao" ADD CONSTRAINT "suit_item_opcao_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "suit_pedido_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suit_pedido_pagamento" ADD CONSTRAINT "suit_pedido_pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "suit_pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

