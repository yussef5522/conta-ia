-- VENDAS FASE 1 item 3 (17/08/2026) — VendaDiaria (derivada) + link N:1 com
-- Transaction. Aditiva pura (CREATE TABLE). Postgres.

CREATE TABLE "venda_diaria" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dataCompetencia" TIMESTAMP(3) NOT NULL,
    "dataCompetenciaFim" TIMESTAMP(3) NOT NULL,
    "meio" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'VENDA',
    "valorLiquido" DOUBLE PRECISION NOT NULL,
    "valorBruto" DOUBLE PRECISION,
    "quantidade" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'EXTRATO_INFERIDO',
    "status" TEXT NOT NULL DEFAULT 'ESTIMADO',
    "isBloco" BOOLEAN NOT NULL DEFAULT false,
    "confirmadoPerfil" BOOLEAN NOT NULL DEFAULT false,
    "anotacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" TEXT,
    "confirmadoPor" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "motivo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "venda_diaria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "venda_diaria_companyId_dataCompetencia_idx" ON "venda_diaria"("companyId", "dataCompetencia");

CREATE TABLE "venda_diaria_transacao" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "venda_diaria_transacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "venda_diaria_transacao_vendaId_transactionId_key" ON "venda_diaria_transacao"("vendaId", "transactionId");
CREATE INDEX "venda_diaria_transacao_transactionId_idx" ON "venda_diaria_transacao"("transactionId");
ALTER TABLE "venda_diaria_transacao" ADD CONSTRAINT "venda_diaria_transacao_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "venda_diaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
