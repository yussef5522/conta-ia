-- ESTOQUE FASE 1 (20/08/2026) — recebimento completo: item/supplier/mapa/LEDGER/
-- conferência/payable-suggestion/evento SEFAZ/saldo-cache. MÓDULO ISOLADO: SÓ CRIA.
-- Zero ALTER/DROP em tabela existente; companyId como valor (sem FK a fechadas).

CREATE TABLE "stock_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidadeControle" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "estoqueMin" DOUBLE PRECISION,
    "estoqueMax" DOUBLE PRECISION,
    "custoUltimo" DOUBLE PRECISION,
    "custoMedio" DOUBLE PRECISION,
    "criadoVia" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "uf" TEXT,
    "criadoVia" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_supplier_product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierCnpj" TEXT NOT NULL,
    "cProd" TEXT NOT NULL,
    "xProd" TEXT,
    "itemId" TEXT NOT NULL,
    "fatorConversao" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidadeNota" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_supplier_product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "custoUnitario" DOUBLE PRECISION NOT NULL,
    "custoTotal" DOUBLE PRECISION NOT NULL,
    "receiptId" TEXT,
    "nfeChave" TEXT,
    "nItem" INTEGER,
    "estornoDeId" TEXT,
    "dataMovimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_movement_qtd" CHECK ("quantidade" <> 0),
    CONSTRAINT "chk_stock_movement_custo" CHECK (abs("custoTotal" - "quantidade" * "custoUnitario") <= 0.01)
);

CREATE TABLE "stock_receipt_conference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_CONFERENCIA',
    "conferidoPorId" TEXT,
    "confirmadoPorId" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_receipt_conference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_conference_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "nfeItemId" TEXT,
    "itemId" TEXT,
    "xProd" TEXT NOT NULL,
    "cProd" TEXT,
    "qtdNota" DOUBLE PRECISION NOT NULL,
    "unidadeNota" TEXT,
    "qtdRecebida" DOUBLE PRECISION,
    "divergencia" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,
    "fotoBase64" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_conference_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_payable_suggestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nfeId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "supplierCnpj" TEXT,
    "supplierNome" TEXT,
    "nDup" TEXT,
    "dVenc" TIMESTAMP(3),
    "valor" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGERIDA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_payable_suggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_sefaz_event" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tpEvento" TEXT NOT NULL,
    "nSeqEvento" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "cStat" TEXT,
    "xMotivo" TEXT,
    "protocolo" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximoRetry" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_sefaz_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_saldo_cache" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL,
    "custoMedio" DOUBLE PRECISION,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_saldo_cache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_item_companyId_ativo_idx" ON "stock_item"("companyId", "ativo");
CREATE INDEX "stock_item_companyId_categoria_idx" ON "stock_item"("companyId", "categoria");
CREATE INDEX "stock_supplier_companyId_idx" ON "stock_supplier"("companyId");
CREATE UNIQUE INDEX "stock_supplier_companyId_cnpj_key" ON "stock_supplier"("companyId", "cnpj");
CREATE INDEX "stock_supplier_product_companyId_itemId_idx" ON "stock_supplier_product"("companyId", "itemId");
CREATE UNIQUE INDEX "stock_supplier_product_companyId_supplierCnpj_cProd_key" ON "stock_supplier_product"("companyId", "supplierCnpj", "cProd");
CREATE INDEX "stock_movement_companyId_itemId_idx" ON "stock_movement"("companyId", "itemId");
CREATE INDEX "stock_movement_companyId_receiptId_idx" ON "stock_movement"("companyId", "receiptId");
CREATE INDEX "stock_movement_estornoDeId_idx" ON "stock_movement"("estornoDeId");
CREATE INDEX "stock_receipt_conference_companyId_status_idx" ON "stock_receipt_conference"("companyId", "status");
CREATE UNIQUE INDEX "stock_receipt_conference_companyId_nfeId_key" ON "stock_receipt_conference"("companyId", "nfeId");
CREATE INDEX "stock_conference_item_companyId_conferenceId_idx" ON "stock_conference_item"("companyId", "conferenceId");
CREATE INDEX "stock_payable_suggestion_companyId_nfeId_idx" ON "stock_payable_suggestion"("companyId", "nfeId");
CREATE INDEX "stock_payable_suggestion_companyId_dVenc_idx" ON "stock_payable_suggestion"("companyId", "dVenc");
CREATE INDEX "stock_sefaz_event_companyId_status_idx" ON "stock_sefaz_event"("companyId", "status");
CREATE INDEX "stock_sefaz_event_companyId_chave_idx" ON "stock_sefaz_event"("companyId", "chave");
CREATE UNIQUE INDEX "stock_saldo_cache_companyId_itemId_key" ON "stock_saldo_cache"("companyId", "itemId");

-- CAMADA 1: stock_movement é IMUTÁVEL. UPDATE/DELETE recusados no banco.
-- Correção = criar movimento de ESTORNO (oposto, estornoDeId → original) + o novo.
CREATE OR REPLACE FUNCTION stock_movement_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MOVIMENTO DE ESTOQUE IMUTAVEL: nao da pra % o movimento % (o ledger nunca edita nem apaga). Correcao = crie um movimento de ESTORNO (oposto, tipo=ESTORNO, estornoDeId apontando o original) e depois o movimento novo.', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_stock_movement_no_update BEFORE UPDATE ON stock_movement FOR EACH ROW EXECUTE FUNCTION stock_movement_imutavel();
CREATE TRIGGER trg_stock_movement_no_delete BEFORE DELETE ON stock_movement FOR EACH ROW EXECUTE FUNCTION stock_movement_imutavel();
