-- ESTOQUE — DESVIO DE RENDIMENTO da conclusão, com o MOTIVO do dono. CREATE-only (isolamento).
--
-- Nasce do pedido de 01/09: "o desvio fica gravado na ordem com o motivo se eu quiser
-- escrever ('queijo veio com muita casca', 'mudou fornecedor')". O número sozinho vira
-- mistério em três meses; o motivo é o que transforma variância em causa.
--
-- Tabela PRÓPRIA e não coluna em stock_producao_conclusao porque a migration do módulo é
-- CREATE-only por regra (guard de CI: 0 ALTER/DROP).
CREATE TABLE "stock_producao_desvio" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "conclusaoId"   TEXT NOT NULL,
    "ordemId"       TEXT NOT NULL,
    -- saiu ÷ esperado pela FICHA (sempre existe)
    "pctTeorico"    DOUBLE PRECISION NOT NULL,
    -- saiu ÷ esperado pela MÉDIA MEDIDA; null enquanto não há histórico
    "pctMedia"      DOUBLE PRECISION,
    -- quantas conclusões compunham a média no momento (0 = não havia régua medida)
    "lotesNaMedia"  INTEGER NOT NULL DEFAULT 0,
    "motivo"        TEXT,
    "criadoPorId"   TEXT,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_producao_desvio_pkey" PRIMARY KEY ("id"),
    -- motivo em branco é pior que motivo ausente: parece preenchido e não diz nada
    CONSTRAINT "chk_desvio_motivo" CHECK ("motivo" IS NULL OR length(trim("motivo")) > 0),
    CONSTRAINT "chk_desvio_lotes" CHECK ("lotesNaMedia" >= 0)
);
-- uma conclusão tem UM desvio (recontar = nova conclusão, nunca edição)
CREATE UNIQUE INDEX "stock_producao_desvio_conclusaoId_key" ON "stock_producao_desvio"("conclusaoId");
CREATE INDEX "stock_producao_desvio_companyId_ordemId_idx" ON "stock_producao_desvio"("companyId", "ordemId");
