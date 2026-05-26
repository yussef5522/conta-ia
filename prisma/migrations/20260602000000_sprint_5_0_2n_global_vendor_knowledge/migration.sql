-- Sprint 5.0.2.n — Cache GLOBAL anonimizado de vendor discovery + audit log.
-- Migration manual pra Postgres (dev SQLite usa `prisma db push`).

CREATE TABLE "global_vendor_knowledge" (
  "id" TEXT NOT NULL,
  "cnpj" TEXT,
  "vendorName" TEXT NOT NULL,
  "vendorNameNormalized" TEXT NOT NULL,
  "razaoSocial" TEXT,
  "nomeFantasia" TEXT,
  "cnaePrincipal" TEXT,
  "cnaeDescricao" TEXT,
  "setor" TEXT,
  "categoriaSugerida" TEXT NOT NULL,
  "categoriaConfidence" DOUBLE PRECISION NOT NULL,
  "tipoTransacao" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "descobertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vezesUsado" INTEGER NOT NULL DEFAULT 0,
  "vezesConfirmado" INTEGER NOT NULL DEFAULT 0,
  "vezesRejeitado" INTEGER NOT NULL DEFAULT 0,
  "scoreAtual" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "ultimaValidacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "global_vendor_knowledge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_vendor_knowledge_cnpj_key"
  ON "global_vendor_knowledge"("cnpj")
  WHERE "cnpj" IS NOT NULL;

CREATE INDEX "global_vendor_knowledge_vendorNameNormalized_idx"
  ON "global_vendor_knowledge"("vendorNameNormalized");

CREATE INDEX "global_vendor_knowledge_scoreAtual_active_idx"
  ON "global_vendor_knowledge"("scoreAtual", "active");

CREATE TABLE "vendor_discovery_logs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "transactionId" TEXT,
  "vendorNameQueried" TEXT NOT NULL,
  "cnpjQueried" TEXT,
  "origem" TEXT NOT NULL,
  "resultado" TEXT NOT NULL,
  "responseTime" INTEGER NOT NULL,
  "custoApi" DOUBLE PRECISION,
  "userAction" TEXT,
  "finalCategoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_discovery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_discovery_logs_companyId_idx"
  ON "vendor_discovery_logs"("companyId");

CREATE INDEX "vendor_discovery_logs_createdAt_idx"
  ON "vendor_discovery_logs"("createdAt");
