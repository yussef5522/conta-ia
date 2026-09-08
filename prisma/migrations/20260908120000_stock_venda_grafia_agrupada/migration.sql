-- ⭐ o rastro de "agrupada por grafia". CREATE-only — não toca em nada existente.
CREATE TABLE "stock_venda_grafia_agrupada" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "viaGrafia" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_venda_grafia_agrupada_pkey" PRIMARY KEY ("id")
);

-- ⛔ uma grafia entra por esta porta UMA vez: reprocessar é inofensivo por construção
CREATE UNIQUE INDEX "stock_venda_grafia_agrupada_companyId_nomeSuitable_key" ON "stock_venda_grafia_agrupada"("companyId", "nomeSuitable");
CREATE INDEX "stock_venda_grafia_agrupada_companyId_criadoEm_idx" ON "stock_venda_grafia_agrupada"("companyId", "criadoEm");
