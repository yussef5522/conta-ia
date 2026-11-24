-- 25/11/2026 — EMPRÉSTIMOS v1 (lei docs/emprestimos-referencia.html, R60 + R65).
-- Autorização nominal do dono: "migrations SÓ ADITIVAS", pg_dump conferido antes.
-- ADITIVA: 1 ADD COLUMN NULA sem default (nenhuma linha existente muda) + 1 CREATE TABLE nova.

-- R60 — excluir contrato COM história: some de todas as telas, o nome sobrevive nos relatórios.
ALTER TABLE "loans" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- R65 — juros de cheque especial confirmados uma vez viram regra (conta + descrição).
CREATE TABLE "cheque_especial_regras" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "padrao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cheque_especial_regras_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cheque_especial_regras_bankAccountId_padrao_key" ON "cheque_especial_regras"("bankAccountId", "padrao");
CREATE INDEX "cheque_especial_regras_companyId_idx" ON "cheque_especial_regras"("companyId");
ALTER TABLE "cheque_especial_regras" ADD CONSTRAINT "cheque_especial_regras_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cheque_especial_regras" ADD CONSTRAINT "cheque_especial_regras_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
