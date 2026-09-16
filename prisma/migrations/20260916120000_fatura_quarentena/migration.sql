-- ⭐⭐⭐ A QUARENTENA DE FATURA (16/09/2026) — CREATE-only, aditiva pura.
--
-- O import de fatura não guardava NADA: nem o PDF, nem o texto extraído. Quando a
-- conferência recusou a fatura do Banrisul hoje, o documento se perdeu e diagnosticar
-- exigia pedir o arquivo de volta ao dono. É o que o `rawOfxBlob` resolveu pro extrato
-- em 13/08 e que nunca chegou aqui.
--
-- ⚠️ Guarda TODA tentativa: a que deu certo é o GOLDEN DE AMANHÃ.
-- ⚠️ ROLLBACK: DROP TABLE "fatura_quarentena";
CREATE TABLE "fatura_quarentena" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT,
  "profileId"      TEXT,
  "cardId"         TEXT NOT NULL,
  "banco"          TEXT NOT NULL,
  "desfecho"       TEXT NOT NULL,
  "motivo"         TEXT,
  "declarado"      DOUBLE PRECISION,
  "calculado"      DOUBLE PRECISION,
  "texto"          TEXT NOT NULL,
  "linhas"         INTEGER NOT NULL DEFAULT 0,
  "fixture"        TEXT,
  "criadoPorId"    TEXT,
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "textoPurgadoEm" TIMESTAMP(3),

  CONSTRAINT "fatura_quarentena_pkey" PRIMARY KEY ("id"),
  -- ⛔ desfecho é fechado: OK (virou golden de amanhã) | RECUSADA (espera diagnóstico)
  CONSTRAINT "chk_fatura_quarentena_desfecho" CHECK ("desfecho" IN ('OK', 'RECUSADA'))
);

CREATE INDEX "fatura_quarentena_companyId_criadoEm_idx" ON "fatura_quarentena"("companyId", "criadoEm");
CREATE INDEX "fatura_quarentena_profileId_criadoEm_idx" ON "fatura_quarentena"("profileId", "criadoEm");
CREATE INDEX "fatura_quarentena_desfecho_criadoEm_idx" ON "fatura_quarentena"("desfecho", "criadoEm");
