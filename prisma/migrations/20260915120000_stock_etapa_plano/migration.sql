-- ⭐ CREATE-only (o isolamento do módulo de estoque, guard de CI desde a Fase 0).
CREATE TABLE "stock_etapa_plano" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "diaPrevisto" TIMESTAMP(3),
    "liberadaParaEquipe" BOOLEAN NOT NULL DEFAULT false,
    "definidoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_etapa_plano_pkey" PRIMARY KEY ("id")
);

-- ⭐ um plano por etapa: duplicar é IMPOSSÍVEL no banco, não "checado"
CREATE UNIQUE INDEX "stock_etapa_plano_etapaId_key" ON "stock_etapa_plano"("etapaId");
CREATE INDEX "stock_etapa_plano_companyId_diaPrevisto_idx" ON "stock_etapa_plano"("companyId", "diaPrevisto");
