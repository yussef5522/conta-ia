-- ⭐⭐⭐ INVESTIMENTOS — o espelho do empréstimo, do lado do ATIVO (25/09/2026)
--
-- ⚠️ ADITIVA PURA: duas tabelas NOVAS, zero ALTER em tabela com dado real. O FK do vínculo
-- fica do lado novo (a ponte), então `transactions` não é tocada.
--
-- ROLLBACK:
--   DROP TABLE "investment_contributions";
--   DROP TABLE "investment_contracts";

CREATE TABLE "investment_contracts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "bankAccountId" TEXT,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "valorParcela" DOUBLE PRECISION NOT NULL,
  "diaDoMes" INTEGER NOT NULL,
  "totalParcelas" INTEGER,
  "parcelasPagasAoIniciar" INTEGER,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investment_contracts_pkey" PRIMARY KEY ("id"),
  -- ⛔ o vocabulário fechado fica no TypeScript (a lição do CHECK do radar, 21/09:
  --    "CHECK com vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal").
  --    Aqui o banco valida só a FORMA.
  CONSTRAINT "chk_investment_dia" CHECK ("diaDoMes" >= 1 AND "diaDoMes" <= 31),
  CONSTRAINT "chk_investment_valor" CHECK ("valorParcela" > 0),
  CONSTRAINT "chk_investment_nome" CHECK (length(trim("nome")) > 0),
  CONSTRAINT "chk_investment_total" CHECK ("totalParcelas" IS NULL OR "totalParcelas" > 0)
);

CREATE INDEX "investment_contracts_companyId_idx" ON "investment_contracts"("companyId");
CREATE INDEX "investment_contracts_companyId_ativo_idx" ON "investment_contracts"("companyId", "ativo");

ALTER TABLE "investment_contracts"
  ADD CONSTRAINT "investment_contracts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_contracts"
  ADD CONSTRAINT "investment_contracts_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "investment_contributions" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "competencia" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "criadoPorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investment_contributions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_contribution_competencia" CHECK ("competencia" ~ '^[0-9]{4}-[0-9]{2}$')
);

-- ⛔ a MESMA linha do extrato não vira dois aportes: impossível, não "checado"
CREATE UNIQUE INDEX "investment_contributions_transactionId_key" ON "investment_contributions"("transactionId");
CREATE INDEX "investment_contributions_contractId_idx" ON "investment_contributions"("contractId");
CREATE INDEX "investment_contributions_contractId_competencia_idx" ON "investment_contributions"("contractId", "competencia");

ALTER TABLE "investment_contributions"
  ADD CONSTRAINT "investment_contributions_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "investment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_contributions"
  ADD CONSTRAINT "investment_contributions_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
