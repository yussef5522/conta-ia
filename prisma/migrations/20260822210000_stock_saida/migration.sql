-- ESTOQUE PARTE C — saída que não é venda (waste log). CREATE-only. MOTIVO obrigatório
-- (CHECK: não vazio) + quantidade > 0 → perda sem motivo é IMPOSSÍVEL por construção.
CREATE TABLE "stock_saida" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "tipoMovimento" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "motivoTexto" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "custoUnitario" DOUBLE PRECISION NOT NULL,
    "custoTotal" DOUBLE PRECISION NOT NULL,
    "fotoBase64" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_saida_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_saida_motivo" CHECK (length(trim("motivo")) > 0),
    CONSTRAINT "chk_saida_qtd" CHECK ("quantidade" > 0),
    CONSTRAINT "chk_saida_tipo" CHECK ("tipoMovimento" IN ('PERDA','USO_INTERNO'))
);
CREATE INDEX "stock_saida_companyId_data_idx" ON "stock_saida"("companyId", "data");
CREATE INDEX "stock_saida_companyId_motivo_idx" ON "stock_saida"("companyId", "motivo");
