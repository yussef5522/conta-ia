-- ⭐⭐ BAIXA PARCIAL DE CONTA A PAGAR (10/09/2026) — CREATE-only.
--
-- ⚠️ NÃO altera `transactions`. O valor pago de uma conta é a SOMA das linhas desta tabela
-- e o "em aberto" é DERIVADO — decisão do dono: *"valor pago acumulado + restante derivado,
-- nunca status na mão"*. Mesmo desenho do `loan_installment_payments`.
--
-- ROLLBACK: DROP TABLE "conciliacao_baixa_parcial";

CREATE TABLE "conciliacao_baixa_parcial" (
  "id"               TEXT NOT NULL,
  "companyId"        TEXT NOT NULL,
  "payableId"        TEXT NOT NULL,
  "extratoId"        TEXT NOT NULL,
  "valor"            DOUBLE PRECISION NOT NULL,
  "reconcileGroupId" TEXT,
  "criadoPorId"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conciliacao_baixa_parcial_pkey" PRIMARY KEY ("id"),
  -- ⛔ baixa de valor zero ou negativo não é baixa
  CONSTRAINT "chk_baixa_parcial_valor" CHECK ("valor" > 0)
);

-- ⛔ a MESMA linha pagando a MESMA conta duas vezes é impossível, não "checado"
CREATE UNIQUE INDEX "conciliacao_baixa_parcial_payableId_extratoId_key"
  ON "conciliacao_baixa_parcial"("payableId", "extratoId");
CREATE INDEX "conciliacao_baixa_parcial_companyId_idx" ON "conciliacao_baixa_parcial"("companyId");
CREATE INDEX "conciliacao_baixa_parcial_payableId_idx" ON "conciliacao_baixa_parcial"("payableId");
CREATE INDEX "conciliacao_baixa_parcial_extratoId_idx" ON "conciliacao_baixa_parcial"("extratoId");

ALTER TABLE "conciliacao_baixa_parcial"
  ADD CONSTRAINT "conciliacao_baixa_parcial_payableId_fkey"
  FOREIGN KEY ("payableId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conciliacao_baixa_parcial"
  ADD CONSTRAINT "conciliacao_baixa_parcial_extratoId_fkey"
  FOREIGN KEY ("extratoId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
