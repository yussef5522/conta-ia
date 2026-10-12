-- ⭐⭐⭐ A PORTA NO BANCO — "nascer incoerente vira IMPOSSÍVEL" (11/10/2026, item 3 do dono).
--
-- Ordem do dono: *"Criar/editar ficha EXIGE coerência: produto contado em UN ⇒ «A receita rende»
-- declarado em UN (o editor não salva torto). CHECK no banco (REGRA 13: NULL tratado) — nascer
-- incoerente vira impossível."*
--
-- ═══ ⛔⛔ POR QUE **NÃO** É UM CHECK, e isso precisa estar escrito ═══
--
-- A comparação é **CROSS-TABLE**: a unidade do rótulo vive em `stock_ficha_versao` e a unidade em
-- que o produto se CONTA vive em `stock_item` (via `stock_ficha.itemProduzidoId`). CHECK não
-- alcança outra tabela — então a forma possível é TRIGGER, e há precedente nesta casa (o trigger
-- de imutabilidade do `stock_movement`, 20/08, e o `loan_installment_no_double_link`, 15/08).
-- Migration de estoque segue CREATE-only: zero ALTER, zero DROP.
--
-- ═══ ⭐⭐ POR QUE CATRACA, E NÃO EXIGÊNCIA SECA ═══
--
-- Medido em prod antes de escrever: a `MAIONESE` (produção) e o sabor `CALABRESA` — **o de maior
-- volume do cardápio** — JÁ ESTÃO tortos, porque nasceram antes da régua. Um trigger que
-- exigisse coerência em toda versão **trancaria a edição legítima deles**, e parede é como o
-- dono aprende a contornar o sistema por fora.
--
-- A catraca recusa exatamente o que tem que recusar:
--   (a) NASCER torto        → versão sem anterior (v1) incoerente = RECUSA
--   (b) REGREDIR            → anterior COERENTE e a nova torta     = RECUSA
--   (c) carregar o legado   → anterior JÁ torta                    = PASSA
--
-- ⚠️ E ela é **VOCABULARY-FREE de propósito**: não pergunta `tipoProduto`. Duplicar a lista de
-- tipos no SQL é a cicatriz de 21/09 — CHECK com vocabulário fechado numa tabela de
-- configuração virou parede em UM DIA, e migration aplicada não se reescreve. Quem conhece o
-- vocabulário é o TypeScript (`comoConsome`); o banco só compara duas unidades.
--
-- ⭐ O par em TS é `avaliarCoerenciaDoRotulo` (nascimento, qualquer tipo) + a catraca do
-- `atualizarFicha`. Os dois lados dizem a MESMA coisa de propósito: se o TS deixasse passar o
-- que o banco recusa, o dono levaria um **500 sem corpo** no lugar da frase que ensina.
--
-- ROLLBACK:
--   DROP TRIGGER trg_stock_ficha_versao_rotulo ON stock_ficha_versao;
--   DROP FUNCTION stock_ficha_rotulo_coerente();

CREATE OR REPLACE FUNCTION stock_ficha_rotulo_coerente() RETURNS trigger AS $$
DECLARE
  un_produto   TEXT;
  nome_produto TEXT;
  un_anterior  TEXT;
BEGIN
  SELECT i."unidadeControle", i.nome
    INTO un_produto, nome_produto
    FROM stock_ficha f
    JOIN stock_item i ON i.id = f."itemProduzidoId"
   WHERE f.id = NEW."fichaId";

  -- ⛔⛔ REGRA 13 — O `IS NULL` VEM EXPLÍCITO E **ANTES** DA COMPARAÇÃO DE CONTEÚDO.
  -- `NEW."unidadeLoteBase" <> un_produto` com qualquer lado NULL avalia pra **NULL**, o IF não
  -- entra, e a versão torta PASSA. É o furo exato do `chk_aviso_acao_completa` (04/10), onde
  -- `length(trim(NULL))` contaminou o AND inteiro. Aqui o NULL é um FATO ("não dá pra conferir")
  -- e o erro seguro é DEIXAR PASSAR — barrar por ausência de dado travaria gravação legítima.
  IF un_produto IS NULL THEN RETURN NEW; END IF;
  IF NEW."unidadeLoteBase" IS NULL THEN RETURN NEW; END IF;
  IF NEW."unidadeLoteBase" = un_produto THEN RETURN NEW; END IF;

  -- incoerente: a catraca olha a versão IMEDIATAMENTE anterior
  SELECT v."unidadeLoteBase"
    INTO un_anterior
    FROM stock_ficha_versao v
   WHERE v."companyId" = NEW."companyId"
     AND v."fichaId"   = NEW."fichaId"
     AND v.versao      = NEW.versao - 1;

  -- (c) o legado continua passando: anterior EXISTE e já era torta
  IF un_anterior IS NOT NULL AND un_anterior <> un_produto THEN
    RETURN NEW;
  END IF;

  -- (a) e (b): nascer torto ou REGREDIR depois de convertida
  RAISE EXCEPTION 'ROTULO DO RENDIMENTO INCOERENTE: "%" se conta em %, entao "A receita rende" tem que estar em % — veio em %. Diga quantas % saem de 1 receita: e esse numero que divide o pedido quando a cozinha separa o material.',
    COALESCE(nome_produto, NEW."fichaId"), un_produto, un_produto, NEW."unidadeLoteBase", un_produto;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_ficha_versao_rotulo
  BEFORE INSERT ON stock_ficha_versao
  FOR EACH ROW EXECUTE FUNCTION stock_ficha_rotulo_coerente();
