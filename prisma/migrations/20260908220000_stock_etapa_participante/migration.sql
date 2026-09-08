-- ⭐ a dupla na mesma etapa: dois relógios próprios. CREATE-only.
CREATE TABLE "stock_ordem_etapa_participante" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "designadoPorId" TEXT,
    "designadoEm" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ordem_etapa_participante_pkey" PRIMARY KEY ("id")
);

-- ⛔ a mesma pessoa duas vezes na mesma etapa é impossível por construção
CREATE UNIQUE INDEX "stock_ordem_etapa_participante_etapaId_colaboradorId_key" ON "stock_ordem_etapa_participante"("etapaId", "colaboradorId");
CREATE INDEX "stock_ordem_etapa_participante_companyId_colaboradorId_fin_idx" ON "stock_ordem_etapa_participante"("companyId", "colaboradorId", "finalizadoEm");
