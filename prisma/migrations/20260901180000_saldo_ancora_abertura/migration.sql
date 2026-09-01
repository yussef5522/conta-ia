-- ⭐⭐ ÂNCORA DE ABERTURA + BLOQUEIO + RÉGUA DIÁRIA DO PDF (01/09/2026).
--
-- ⚠️ ALTERs em tabela com DADOS REAIS (bank_accounts, 11 linhas):
--   tabela        | operação           | tipo             | risco  | mitigação
--   bank_accounts | ADD COLUMN × 5     | nullable, s/default | BAIXO | 100% aditiva; NULL =
--                 |                    |                  |        | comportamento de hoje,
--                 |                    |                  |        | byte por byte (o caminho
--                 |                    |                  |        | novo é CONDICIONAL à âncora)
-- Rollback: DROP COLUMN das 5 + DROP TABLE das 2.

-- A ABERTURA CONFERIDA: o ponto a partir do qual o LEDGER manda no saldo.
-- Substitui o LEDGERBAL como fonte — o declarado pelo banco vira CONFERÊNCIA.
ALTER TABLE "bank_accounts" ADD COLUMN "openingBalance" DOUBLE PRECISION;
ALTER TABLE "bank_accounts" ADD COLUMN "openingDate" TIMESTAMP(3);
-- ⭐ exigência do dono: a âncora diz DE ONDE VEIO, e isso aparece na tela.
-- ex: "SALDO ANT 31/07 do PDF do Banrisul emitido 01/09 13:55"
ALTER TABLE "bank_accounts" ADD COLUMN "openingSource" TEXT;

-- ⭐ BLOQUEIO é campo da CONTA, nunca transação (o "(+) BLOQUEADO + 24 HS" do Banrisul).
-- Muda todo dia e só vale no instante do PDF — por isso vem datado.
ALTER TABLE "bank_accounts" ADD COLUMN "blockedAmount" DOUBLE PRECISION;
ALTER TABLE "bank_accounts" ADD COLUMN "blockedAt" TIMESTAMP(3);

-- ⭐ A RÉGUA: um saldo CONTÁBIL declarado por dia, lido do PDF. O selo "conferido" é
-- DERIVADO daqui contra o ledger, nunca gravado — selo gravado envelhece e mente.
CREATE TABLE "bank_account_saldo_declarado" (
    "id"             TEXT NOT NULL,
    "bankAccountId"  TEXT NOT NULL,
    "data"           TIMESTAMP(3) NOT NULL, -- meia-noite UTC (normalizado no código; SQLite do dev não tem DATE)
    "saldoContabil"  DOUBLE PRECISION NOT NULL,
    "origem"         TEXT NOT NULL,
    "emitidoEm"      TIMESTAMP(3),
    "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_account_saldo_declarado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_account_saldo_declarado_conta_fkey" FOREIGN KEY ("bankAccountId")
        REFERENCES "bank_accounts"("id") ON DELETE CASCADE
);
-- reimportar o mesmo PDF atualiza o dia, nunca duplica
CREATE UNIQUE INDEX "bank_account_saldo_declarado_conta_data_key"
    ON "bank_account_saldo_declarado"("bankAccountId", "data");

-- ⭐⭐ MUDAR A ÂNCORA É EVENTO AUDITADO (exigência do dono): quem, quando, e o valor
-- ANTERIOR. Se um dia jun/jul for importado certo e a âncora andar pra trás, o rastro fica.
-- ⛔ E dia que não fecha NUNCA move a âncora sozinho — ela só muda por decisão do dono.
CREATE TABLE "bank_account_opening_event" (
    "id"            TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "valorAnterior" DOUBLE PRECISION,
    "dataAnterior"  TIMESTAMP(3),
    "valorNovo"     DOUBLE PRECISION NOT NULL,
    "dataNova"      TIMESTAMP(3) NOT NULL,
    "origem"        TEXT NOT NULL,
    "userId"        TEXT,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_account_opening_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_account_opening_event_conta_fkey" FOREIGN KEY ("bankAccountId")
        REFERENCES "bank_accounts"("id") ON DELETE CASCADE
);
CREATE INDEX "bank_account_opening_event_conta_idx"
    ON "bank_account_opening_event"("bankAccountId", "criadoEm");
