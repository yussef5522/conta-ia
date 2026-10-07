-- ⭐⭐ MARGEM & EQUILÍBRIO v3 (07/10/2026) — CREATE-only, ADITIVA PURA. Zero ALTER.
--
-- ⭐⭐ O RETRATO ENCOLHEU ESTA MIGRATION DE 5 TABELAS PRA 2, e vale registrar o que NÃO
-- precisou nascer:
--   · SABOR  → já existe como `tipoProduto='SABOR'` em `stock_ficha` (50 fichas ativas em
--              prod, 107 dos 127 nomes do mapa de complemento já apontam pra elas).
--   · EMBALAGEM → já declarada como COMPONENTE de ficha (28 itens EMBALAGEM no catálogo,
--              40 componentes de ficha). A ficha de margem SEPARA na tela; não há entidade
--              nova a criar.
--   · FATOR por tamanho → **MORREU do sprint** (decisão do dono, 07/10): a regra de 02/09
--              manda (*"1 ocorrência = 1 explosão, SEMPRE"*), e o relatório de complementos
--              não tem campo de tamanho pra sustentar fator nenhum.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_canal_venda";
--   DROP TABLE IF EXISTS "stock_regra_sabores_tamanho";

-- ─────────────────────────────────────────────────────────────────────────────
-- CANAIS DE VENDA + TAXA (item 4)
-- ⚠️ A taxa é % do PREÇO, guardada como FRAÇÃO (0.12 = 12%) — a mesma convenção da
--    `margem.pct` da casa, pra não existirem duas escalas de percentual no sistema.
-- ⛔ `taxaPct` é NULLABLE de propósito: canal que o dono criou e ainda não sabe a taxa fica
--    "a declarar" na tela — **nunca 0%**, que afirmaria que o canal é de graça. Foi essa a
--    razão de o iFood não entrar semeado: o dono deixou a % em branco no pedido.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "stock_canal_venda" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "nome"         TEXT NOT NULL,
  "taxaPct"      DOUBLE PRECISION,
  "ativo"        BOOLEAN NOT NULL DEFAULT true,
  "criadoPorId"  TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_canal_venda_pkey" PRIMARY KEY ("id"),
  -- ⛔ nome vazio viraria canal fantasma na tela de margem
  CONSTRAINT "chk_canal_nome" CHECK (length(trim("nome")) > 0),
  -- ⛔⛔ taxa fora de [0,1) seria % digitado como inteiro (12 em vez de 0,12) e a sobra do
  --     canal viraria negativa gigante. ⚠️ REGRA 13: o `IS NULL` vem EXPLÍCITO e ANTES —
  --     `"taxaPct" >= 0` com NULL devolve NULL, e **CHECK com expressão NULL PASSA**.
  CONSTRAINT "chk_canal_taxa" CHECK (
    "taxaPct" IS NULL OR ("taxaPct" IS NOT NULL AND "taxaPct" >= 0 AND "taxaPct" < 1)
  )
);

-- ⛔ dois canais com o mesmo nome na mesma empresa é impossível: a ficha de margem mostra
--    um por coluna, e duplicata viraria duas colunas idênticas com taxas diferentes
CREATE UNIQUE INDEX "stock_canal_venda_company_nome_key"
  ON "stock_canal_venda"("companyId", lower(trim("nome")));
CREATE INDEX "stock_canal_venda_company_idx" ON "stock_canal_venda"("companyId", "ativo");

-- ─────────────────────────────────────────────────────────────────────────────
-- QUANTOS SABORES CADA TAMANHO OBRIGA (itens 2, 3 e 7)
-- ⚠️ É DECLARAÇÃO DO DONO, com rastro — nunca medição. A razão medida em prod oscila de
--    **0,37 a 7,03** sabores/pizza em 31 dias, então derivar o número do dado produziria
--    um fator diferente a cada semana (é a mesma razão por que o fator por tamanho caiu).
-- ⛔ `sabores` NÃO tem default: tamanho cadastrado sem o número ficaria valendo 1 em
--    silêncio, e o montador desenharia a pizza errada.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "stock_regra_sabores_tamanho" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "tamanho"      TEXT NOT NULL,
  "sabores"      INTEGER NOT NULL,
  "criadoPorId"  TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_regra_sabores_tamanho_pkey" PRIMARY KEY ("id"),
  -- ⛔ FORMA, nunca VOCABULÁRIO (a lição de 21/09: CHECK com lista fechada numa tabela de
  --    CONFIGURAÇÃO virou parede em UM dia). Tamanho novo ("BROTO") entra sem migration;
  --    quem decide o vocabulário é o TypeScript.
  CONSTRAINT "chk_regra_tamanho_forma" CHECK (
    "tamanho" = upper("tamanho") AND length(trim("tamanho")) > 0
  ),
  -- ⛔ 0 sabores não é tamanho de pizza; acima de 12 é digitação torta
  CONSTRAINT "chk_regra_sabores" CHECK ("sabores" >= 1 AND "sabores" <= 12)
);

CREATE UNIQUE INDEX "stock_regra_sabores_tamanho_key"
  ON "stock_regra_sabores_tamanho"("companyId", "tamanho");
