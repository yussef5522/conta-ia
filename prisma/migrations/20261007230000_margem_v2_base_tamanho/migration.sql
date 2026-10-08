-- ⭐⭐ A BASE DE CADA TAMANHO DE PIZZA (07/10/2026, v2 do "quem paga a casa").
-- CREATE-only, ADITIVA PURA. Zero ALTER, zero DROP.
--
-- ⭐ O QUE ELA GUARDA: qual ficha do cardápio é a BASE de um tamanho — a massa + o queijo +
-- a caixa, o que existe na pizza ANTES de o cliente escolher o sabor. O montador soma
-- `base + Σ(1 ocorrência × ficha de cada sabor)`, que é a regra de 02/09 sem fator.
--
-- ⚠️ POR QUE TABELA NOVA E NÃO UMA COLUNA EM `stock_regra_sabores_tamanho`: migration de
-- estoque é CREATE-only (guard de CI `migration-isolation.test.ts` — 0 ALTER/DROP), e a
-- tabela de ontem está CERTA no que ela faz. São duas declarações com donos diferentes:
--   · quantos sabores o tamanho obriga → regra de CARDÁPIO (o dono decide o que o cliente
--     pode escolher) e ela DERIVA pro precinho;
--   · qual ficha é a base → RECEITA, e ela muda quando a ficha muda, sem a outra mudar.
--
-- ⚠️⚠️ E A ESCOLHA É DO DONO, NUNCA DEDUZIDA. Medido em prod: o PDV tem 13 nomes de pizza, e
-- pro tamanho GRANDE existem QUATRO candidatos com fichas DIFERENTES — `PIZZA GRANDE 35CM`,
-- `Pizza Grande (35cm)` (2 × porção de queijo, SEM massa), `PIZZA GRANDE PROMO` e
-- `PIZZA GRANDE PRECINHO` (2 × queijo + 2 × metade de massa). Eleger uma por heurística
-- somaria a base errada em silêncio, e a diferença entre elas é justamente a massa.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_base_do_tamanho";

CREATE TABLE "stock_base_do_tamanho" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "tamanho"      TEXT NOT NULL,
  "fichaId"      TEXT NOT NULL,
  "criadoPorId"  TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_base_do_tamanho_pkey" PRIMARY KEY ("id"),
  -- ⛔ FORMA, nunca VOCABULÁRIO (a lição de 21/09: CHECK com lista fechada numa tabela de
  --    CONFIGURAÇÃO virou parede em UM dia). Tamanho novo ("BROTO") entra sem migration;
  --    quem decide o vocabulário é o TypeScript. É a MESMA régua da tabela irmã.
  CONSTRAINT "chk_base_tamanho_forma" CHECK (
    "tamanho" = upper("tamanho") AND length(trim("tamanho")) > 0
  ),
  -- ⛔ ficha vazia viraria base fantasma: o montador somaria `null` e diria "a declarar"
  --    sobre uma linha que existe — pior que a ausência, porque parece configurado
  CONSTRAINT "chk_base_ficha" CHECK (length(trim("fichaId")) > 0)
);

-- ⛔ um tamanho tem UMA base: duas linhas dariam dois custos pra mesma pizza, e o montador
--    escolheria a primeira que viesse do banco (ordem arbitrária) — a família do desempate
--    arbitrário que custou dois alarmes de ±3.026,31 no juiz de saldo em 28/08
CREATE UNIQUE INDEX "stock_base_do_tamanho_key"
  ON "stock_base_do_tamanho"("companyId", "tamanho");
CREATE INDEX "stock_base_do_tamanho_ficha_idx"
  ON "stock_base_do_tamanho"("companyId", "fichaId");
