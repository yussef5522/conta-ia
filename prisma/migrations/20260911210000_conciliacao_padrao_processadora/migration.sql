-- ⭐ O PADRÃO APRENDIDO DA PROCESSADORA DE BOLETO (11/09/2026)
--
-- "o vínculo ensina o padrão ('PJBANK costuma ser o boleto do aluguel')" — o dono.
--
-- CREATE-only. A chave é (empresa, padrão) e o `vezes` conta quantas vezes ELE confirmou:
-- é o número que a tela mostra, e é o que separa "palpite de valor" de "já vi isso antes".
-- ROLLBACK: DROP TABLE "conciliacao_padrao_processadora";
CREATE TABLE "conciliacao_padrao_processadora" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "processadora"  TEXT NOT NULL,
  "chave"         TEXT NOT NULL,
  "contaDescricao" TEXT NOT NULL,
  "vezes"         INTEGER NOT NULL DEFAULT 1,
  "ultimoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId"   TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conciliacao_padrao_processadora_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_padrao_vezes" CHECK ("vezes" > 0)
);
CREATE UNIQUE INDEX "conciliacao_padrao_processadora_chave_key"
  ON "conciliacao_padrao_processadora"("companyId", "chave");
