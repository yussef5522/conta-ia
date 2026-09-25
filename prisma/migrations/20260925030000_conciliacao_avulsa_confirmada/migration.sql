-- ⭐⭐⭐ "ESTA SAÍDA NÃO TEM NOTA" — a decisão explícita (25/09/2026).
--
-- ADITIVA PURA: CREATE TABLE nova, nenhum ALTER, nenhum DROP. Zero linha existente é tocada.
-- ROLLBACK: DROP TABLE conciliacao_avulsa_confirmada;
--
-- ⚠️ Tabela e não coluna em `transactions`: a decisão tem AUTOR e DATA (o contador pergunta),
-- e um boolean não guarda nem um nem outro.
CREATE TABLE "conciliacao_avulsa_confirmada" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "transactionId"   TEXT NOT NULL,
  "motivo"          TEXT,
  "confirmadoPorId" TEXT,
  "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conciliacao_avulsa_confirmada_pkey" PRIMARY KEY ("id"),
  -- ⛔ confirmar duas vezes a mesma linha é IMPOSSÍVEL, não "checado"
  CONSTRAINT "chk_avulsa_motivo" CHECK ("motivo" IS NULL OR length(btrim("motivo")) > 0)
);

CREATE UNIQUE INDEX "conciliacao_avulsa_confirmada_transactionId_key"
  ON "conciliacao_avulsa_confirmada"("transactionId");
CREATE INDEX "conciliacao_avulsa_confirmada_companyId_criadoEm_idx"
  ON "conciliacao_avulsa_confirmada"("companyId", "criadoEm");
