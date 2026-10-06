-- ⭐⭐⭐ CUSTOS FIXOS (06/10/2026) — "a casa num olhar". ADITIVA PURA: 2 CREATE TABLE, zero ALTER.
--
-- ⛔⛔ O REALIZADO NÃO TEM COLUNA AQUI, de propósito. Ele vem das `transactions` já
-- categorizadas, pela porta do `whereFluxoCaixa`. Gravar realizado seria a 2ª fonte do
-- mesmo fato — a doença do `CreditCardInvoice.status` (eternamente OPEN depois de vencer) e
-- do `balance` que driftou R$ 2.112,00 em 30/09. Decisão se grava; fato se deriva.
--
-- ⚠️⚠️ REGRA 13 — TODO CHECK AQUI TEM PROVA CONTRA POSTGRES: `scripts/prova-check-custos-fixos.ts`.
-- CHECK não existe no schema Prisma e o `db push` do dev (SQLite) NÃO o cria, então um CHECK
-- furado passaria a suíte inteira e morderia **só em produção** — foi exatamente o que o
-- `chk_aviso_acao_completa` fez em 04/10 (lógica de três valores: `length(trim(NULL))` é NULL,
-- e CHECK com expressão NULL **PASSA**).
--
-- ROLLBACK: DROP TABLE "custo_fixo_planejado"; DROP TABLE "custo_fixo_categoria";

CREATE TABLE "custo_fixo_categoria" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "marcadoPorId" TEXT,
    "marcadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removidoPorId" TEXT,
    "removidoEm" TIMESTAMP(3),

    CONSTRAINT "custo_fixo_categoria_pkey" PRIMARY KEY ("id"),

    -- ⚠️ REGRA 13: `IS NOT NULL`/`IS NULL` NUNCA devolvem NULL, então não há o terceiro valor
    -- que furou o CHECK do aviso. A régua: quem tem autor de remoção tem a DATA da remoção —
    -- meia-remoção ("alguém tirou, não sei quando") é estado que não pode nascer.
    CONSTRAINT "chk_custo_fixo_categoria_remocao"
        CHECK ("removidoEm" IS NOT NULL OR "removidoPorId" IS NULL)
);

-- ⛔ a mesma categoria virar dois custos fixos é IMPOSSÍVEL, não "checado no app"
CREATE UNIQUE INDEX "custo_fixo_categoria_companyId_categoryId_key"
    ON "custo_fixo_categoria"("companyId", "categoryId");
CREATE INDEX "custo_fixo_categoria_companyId_removidoEm_idx"
    ON "custo_fixo_categoria"("companyId", "removidoEm");

ALTER TABLE "custo_fixo_categoria" ADD CONSTRAINT "custo_fixo_categoria_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custo_fixo_categoria" ADD CONSTRAINT "custo_fixo_categoria_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "custo_fixo_planejado" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "definidoPorId" TEXT,
    "definidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custo_fixo_planejado_pkey" PRIMARY KEY ("id"),

    -- ⚠️ plano NEGATIVO não existe (custo fixo é o que a casa PAGA). Zero é legítimo e
    -- significa "declarei que aqui não deve sair nada neste mês" — diferente de AUSÊNCIA de
    -- linha, que significa "ainda não declarei". Dois estados, dois significados.
    CONSTRAINT "chk_custo_fixo_planejado_valor" CHECK ("valor" >= 0),

    -- ⚠️ CHECK de FORMA, nunca de vocabulário (a cicatriz de 21/09: o CHECK com a lista
    -- `IN ('CAROS','PORCOES')` virou PAREDE um dia depois, quando o dono pediu a 3ª lista).
    CONSTRAINT "chk_custo_fixo_planejado_mes" CHECK ("mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

-- ⛔ um plano por categoria por mês — editar é UPDATE, nunca uma 2ª linha competindo
CREATE UNIQUE INDEX "custo_fixo_planejado_companyId_categoryId_mes_key"
    ON "custo_fixo_planejado"("companyId", "categoryId", "mes");
CREATE INDEX "custo_fixo_planejado_companyId_mes_idx"
    ON "custo_fixo_planejado"("companyId", "mes");

ALTER TABLE "custo_fixo_planejado" ADD CONSTRAINT "custo_fixo_planejado_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custo_fixo_planejado" ADD CONSTRAINT "custo_fixo_planejado_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
