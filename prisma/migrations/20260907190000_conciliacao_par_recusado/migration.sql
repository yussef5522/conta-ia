-- ⭐ "não é isso": a recusa de um par sugerido. CREATE-only — não toca em nada existente.
CREATE TABLE "conciliacao_par_recusado" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "extratoId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "motivo" TEXT,
    "recusadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliacao_par_recusado_pkey" PRIMARY KEY ("id")
);

-- ⛔ recusar o MESMO par duas vezes é impossível por construção
CREATE UNIQUE INDEX "conciliacao_par_recusado_extratoId_contaId_key" ON "conciliacao_par_recusado"("extratoId", "contaId");
CREATE INDEX "conciliacao_par_recusado_companyId_criadoEm_idx" ON "conciliacao_par_recusado"("companyId", "criadoEm");
