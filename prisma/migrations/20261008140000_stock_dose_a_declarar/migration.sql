-- ⭐⭐ A DOSE QUE FALTA DECLARAR (08/10/2026, normalização das bases de pizza).
-- CREATE-only, ADITIVA PURA. Zero ALTER, zero DROP.
--
-- ⭐ O QUE ELA GUARDA: "esta ficha usa este item e a DOSE é do dono". É a linha honesta
-- *"a declarar"* que a ficha mostra — nascida da ordem de 07/10 sobre o MOLHO:
--   *"MOLHO: linha 'a declarar' honesta em cada base (a dose é do dono — nunca inventar;
--    a ficha diz que falta)"*.
--
-- ⛔⛔ POR QUE NÃO BOTAR O MOLHO NA FICHA COM UMA QUANTIDADE QUALQUER: o molho de pizza custa
-- R$ 6,22/UN e passam ~3.035 pizzas por mês. Uma dose inventada de 0,1 ou 0,2 muda o custo
-- da base em R$ 0,62 a R$ 1,24 por pizza — R$ 1.880 a R$ 3.760 por mês — e **sai plausível**,
-- então ninguém desconfia. É a classe do "número sem régua em tela de dinheiro", no pior
-- lugar possível: dentro da receita, de onde o custo escorre pro cardápio, pro CMV e pra liga.
--
-- ⚠️ POR QUE TABELA E NÃO UM TEXTO NO `modoPreparo`: pendência que vive em texto livre é
-- pendência que ninguém consegue CONTAR nem vigiar. Em tabela, a ficha mostra a linha, o
-- cardápio mostra, e um invariante futuro pode cobrar — texto num campo de preparo some da
-- vista no primeiro ajuste de receita.
--
-- ⚠️ E A PENDÊNCIA SE RESOLVE SOZINHA quando o dono declara a dose: o leitor esconde a linha
-- cujo item JÁ é componente da versão atual da ficha. Nada a apagar na mão — a mesma régua
-- do "dispensado" das vendas, que deixa de valer quando o fato muda.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_dose_a_declarar";

CREATE TABLE "stock_dose_a_declarar" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "fichaId"     TEXT NOT NULL,
  "itemId"      TEXT NOT NULL,
  -- ⚠️ o PORQUÊ fica escrito: pendência sem motivo é mistério, e em três meses ninguém sabe
  --    se o item ficou de fora por decisão ou por esquecimento
  "motivo"      TEXT NOT NULL,
  "criadoPorId" TEXT,
  "criadoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_dose_a_declarar_pkey" PRIMARY KEY ("id"),
  -- ⛔ REGRA 13 — CHECK sobre coluna NOT NULL, mas a FORMA ainda importa: string em branco
  --    passaria por `length(x) > 0` se alguém gravasse espaços, e a tela mostraria uma
  --    pendência sem texto. `trim` antes do tamanho, sempre.
  CONSTRAINT "chk_dose_declarar_ficha" CHECK (length(trim("fichaId")) > 0),
  CONSTRAINT "chk_dose_declarar_item"  CHECK (length(trim("itemId"))  > 0),
  CONSTRAINT "chk_dose_declarar_motivo" CHECK (length(trim("motivo")) > 0)
);

-- ⛔ a MESMA pendência duas vezes é IMPOSSÍVEL, não "checado": sem isto, aplicar a
--    normalização duas vezes (ou dois cliques) empilharia a linha do molho e a ficha diria
--    "falta o molho" N vezes — a família do índice único que fez recontar virar UPDATE
CREATE UNIQUE INDEX "stock_dose_a_declarar_key"
  ON "stock_dose_a_declarar"("companyId", "fichaId", "itemId");
CREATE INDEX "stock_dose_a_declarar_ficha_idx"
  ON "stock_dose_a_declarar"("companyId", "fichaId");
