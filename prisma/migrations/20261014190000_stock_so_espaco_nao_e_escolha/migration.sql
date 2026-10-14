-- ⭐⭐⭐ `'   '` NÃO É UMA ESCOLHA — A ARMADURA DOS 2 CHECKs FRACOS DO ESTOQUE (14/10/2026).
--
-- Ordem do dono (item 3 do sprint do trilho): *"mesma família do `'   '` (espaço passando por
-- escolha) em 2 campos `stock_`. ALTER é proibido pelo guard de CI, então fecha pelo caminho que
-- a casa permite — trigger (REGRA 13: NULL explícito PRIMEIRO) e/ou trava 422 na porta única — e
-- REPORTA qual caminho foi."* **Foram os DOIS, cada um pelo motivo dele** (ver o relatório).
--
-- ═══ ⛔⛔ O BURACO, MEDIDO ═══
--
--   stock_radar_item      CHECK ("lista" <> '' AND "lista" = upper("lista"))        -- 21/09
--   stock_venda_ignorado  CHECK ("nomeSuitable" <> '')                              -- 23/09
--
-- **`<> ''` SÓ PEGA A STRING VAZIA.** Pra `'   '` os dois são `true` — e `'   ' = upper('   ')`
-- também, então nem o `upper` do radar ajuda. É exatamente a forma fraca que a prova REGRA 13 do
-- trilho pegou em prod na manhã de 14/10 (*"5 de 6 recusados"*), ali consertada por **ALTER do
-- CHECK** — caminho que o estoque não tem.
--
-- ═══ ⛔⛔ POR QUE **NÃO** É UM ALTER, e isso precisa estar escrito ═══
--
-- (a) migration de estoque é **CREATE-only por regra dura**, com guard no CI
--     (`lib/stock/__tests__/migration-isolation.test.ts` reprova `ALTER TABLE`/`DROP`);
-- (b) e mesmo sem o guard, **migration APLICADA não se reescreve** — o checksum do Prisma reprova
--     o deploy (a cicatriz de 04/10). Não há como consertar o CHECK onde ele nasceu.
--
-- O precedente da casa pra isso é TRIGGER: `loan_installment_no_double_link` (15/08), o trigger
-- de imutabilidade do `stock_movement` (20/08) e `stock_ficha_rotulo_coerente` (11/10).
--
-- ═══ ⭐ POR QUE UMA FUNÇÃO PRA AS DUAS TABELAS ═══
--
-- A pergunta é a MESMA (*"este texto é uma escolha ou é espaço?"*) e o valor chega por
-- `TG_ARGV[0]` (o nome da coluna). Duas funções divergiriam no primeiro caractere novo — e seria
-- a doença dos 7 detectores de par, em SQL. ⚠️ O par em TypeScript é `lib/stock/texto-de-escolha.ts`
-- (`exigirEscolha`), que é quem dá a FRASE que ensina; este trigger é o espelho, e existe pro
-- caminho que não passa pela porta. Se o TS deixasse passar o que o banco recusa, o dono levaria
-- um **500 sem corpo** no lugar da recusa que explica — por isso a porta é a mais ESTRITA das
-- duas (o `trim()` do JS come NBSP/zero-width; o do SQL, só ASCII).
--
-- ═══ ⚠️ VOCABULARY-FREE, de propósito ═══
--
-- O trigger NÃO pergunta quais listas existem nem quais nomes de PDV são válidos — só se há
-- CONTEÚDO. É a cicatriz de 21/09 (`CHECK (lista IN ('CAROS','PORCOES'))` virou parede em UM DIA
-- quando o dono pediu a 3ª lista) e de 23/09 (o `IGNORAR` 9 dias morto). **Vocabulário mora no
-- TypeScript, onde crescer é barato; o banco valida FORMA.**
--
-- ROLLBACK:
--   DROP TRIGGER trg_stock_radar_item_escolha ON stock_radar_item;
--   DROP TRIGGER trg_stock_venda_ignorado_escolha ON stock_venda_ignorado;
--   DROP FUNCTION stock_texto_de_escolha();

CREATE OR REPLACE FUNCTION stock_texto_de_escolha() RETURNS trigger AS $$
DECLARE
  coluna TEXT := TG_ARGV[0];
  valor  TEXT;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', coluna) INTO valor USING NEW;

  -- ⛔⛔⛔ REGRA 13 — O `IS NULL` VEM EXPLÍCITO E **ANTES** DA COMPARAÇÃO DE CONTEÚDO.
  --
  -- `length(trim(NULL))` **não é 0, é NULL**, e NULL contamina a condição inteira: o `IF` não
  -- entra e o torto PASSA. É o furo exato do `chk_aviso_acao_completa` (04/10), onde
  -- `length(trim(...))` sobre coluna nullable deixou "botão pela metade" entrar.
  --
  -- ⚠️ Hoje as duas colunas são `NOT NULL`, então este ramo é REDUNDANTE — e é justamente por
  -- isso que ele está escrito: **a migration que um dia tornar a coluna nullable não vai lembrar
  -- de revisar este trigger.** E aqui NULL é um FATO ("não há texto"), não "não dá pra
  -- conferir": o erro seguro é RECUSAR, porque linha sem o texto não casa com nada depois.
  IF valor IS NULL THEN
    RAISE EXCEPTION
      'TEXTO DE ESCOLHA VAZIO: a coluna "%" de % chegou NULL. Espaço em branco (ou ausência) não é uma escolha — uma linha dessas não casa com nada depois. Mande o valor de verdade.',
      coluna, TG_TABLE_NAME;
  END IF;

  IF length(trim(valor)) = 0 THEN
    RAISE EXCEPTION
      'TEXTO DE ESCOLHA SÓ-ESPAÇO: a coluna "%" de % chegou com %L. O CHECK `<> ''''` só pega a string vazia; espaço em branco não é uma escolha, e uma linha dessas não casa com nada depois.',
      coluna, TG_TABLE_NAME, valor;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ⚠️ `BEFORE INSERT OR UPDATE` — corrigir uma linha PRA torto é tão ruim quanto nascer torto, e o
-- `porNaLista`/`upsertVendaMap` gravam por UPSERT (que é UPDATE quando a chave já existe).
CREATE TRIGGER trg_stock_radar_item_escolha
  BEFORE INSERT OR UPDATE ON stock_radar_item
  FOR EACH ROW EXECUTE FUNCTION stock_texto_de_escolha('lista');

CREATE TRIGGER trg_stock_venda_ignorado_escolha
  BEFORE INSERT OR UPDATE ON stock_venda_ignorado
  FOR EACH ROW EXECUTE FUNCTION stock_texto_de_escolha('nomeSuitable');
