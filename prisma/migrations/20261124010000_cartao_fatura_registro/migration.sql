-- CARTÕES v3 (24/11/2026, docs/cartoes-referencia.html R46–R48) — fatura PJ como REGISTRO,
-- parcelas futuras gravadas e o "antes" do casamento de pagamento (pro desfazer devolver tudo).
-- Autorização nominal do dono: "migrations ADITIVAS (CREATE TABLE; coluna nova só NULA)".
-- ADITIVA: 2 CREATE TABLE + 4 ADD COLUMN NULA em "transactions" (sem default, sem backfill aqui).
-- ⛔ Nenhuma linha nasce aqui: o backfill é script próprio, idempotente, com contagem antes/depois.

CREATE TABLE "business_card_invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "fechamento" TIMESTAMP(3),
    "vencimento" TIMESTAMP(3),
    "totalDeclarado" DOUBLE PRECISION,
    "disponivelDeclarado" DOUBLE PRECISION,
    "origem" TEXT NOT NULL,
    "importId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_card_invoices_pkey" PRIMARY KEY ("id"),
    -- REGRA 13: IS NOT NULL explícito e primeiro
    CONSTRAINT "chk_bci_mes" CHECK ("mes" IS NOT NULL AND "mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "chk_bci_origem" CHECK ("origem" IS NOT NULL AND "origem" IN ('IMPORT', 'BACKFILL'))
);
CREATE UNIQUE INDEX "business_card_invoices_cardId_mes_key" ON "business_card_invoices"("cardId", "mes");
CREATE INDEX "business_card_invoices_companyId_idx" ON "business_card_invoices"("companyId");
ALTER TABLE "business_card_invoices" ADD CONSTRAINT "business_card_invoices_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "business_credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "business_card_installments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "mes" TEXT NOT NULL,
    "origemTxId" TEXT NOT NULL,
    "realizadaTxId" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_card_installments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_bcinst_mes" CHECK ("mes" IS NOT NULL AND "mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "chk_bcinst_numero" CHECK ("numero" IS NOT NULL AND "total" IS NOT NULL AND "numero" >= 2 AND "numero" <= "total"),
    CONSTRAINT "chk_bcinst_valor" CHECK ("valor" IS NOT NULL AND "valor" > 0)
);
CREATE UNIQUE INDEX "business_card_installments_cardId_grupo_numero_key" ON "business_card_installments"("cardId", "grupo", "numero");
CREATE INDEX "business_card_installments_companyId_mes_idx" ON "business_card_installments"("companyId", "mes");
CREATE INDEX "business_card_installments_cardId_mes_idx" ON "business_card_installments"("cardId", "mes");
ALTER TABLE "business_card_installments" ADD CONSTRAINT "business_card_installments_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "business_credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- coluna nova NULA, sem default (não reescreve a tabela; nenhuma linha existente muda)
ALTER TABLE "transactions" ADD COLUMN "cardPaymentPrevCategoryId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "cardPaymentPrevFlag" BOOLEAN;
ALTER TABLE "transactions" ADD COLUMN "cardUsdAmount" DOUBLE PRECISION;
ALTER TABLE "transactions" ADD COLUMN "cardFxRate" DOUBLE PRECISION;
