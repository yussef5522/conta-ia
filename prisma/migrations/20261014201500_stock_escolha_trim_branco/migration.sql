-- ⭐⭐ `trim()` DO POSTGRES REMOVE SÓ **ESPAÇO** — TAB E NEWLINE PASSAVAM (14/10/2026, tarde).
--
-- ═══ ⛔⛔ O GAP, MEDIDO NO PRÓPRIO BANCO DE PROD ═══
--
--   SELECT length(trim(E'\t')),  length(trim(E'\n')),  length(trim('   '));
--            →        1                   1                    0
--
-- Ou seja: `length(trim(valor)) = 0` do trigger de hoje de manhã morde o `'   '` (o defeito que
-- o dono pediu pra fechar) e **NÃO morde `'\t'` nem `'\n'`** — o `btrim` do Postgres apara, por
-- default, **somente o caractere espaço**, ao contrário do `String.prototype.trim()` do JS, que
-- apara toda a classe de espaço em branco.
--
-- ⚠️⚠️ **E ISSO EU HAVIA ESCRITO AO CONTRÁRIO.** O comentário de `lib/stock/texto-de-escolha.ts`
-- dizia que o `trim()` do JS ser mais estrito que o do SQL era "a direção segura", porque a PORTA
-- recusaria antes de o banco ver. É verdade **pra quem passa pela porta** — e a camada 1 existe
-- justamente pro caminho que NÃO passa (script, lib nova, `$executeRawUnsafe`, lançamento em
-- lote). Por ali, `'\t'` entrava, e uma linha dessas não casa com nada depois igual ao `'   '`.
--
-- ⭐ Quem achou foi a prova da REGRA 13 contra Postgres real (`prova-check-estoque-so-espaco.ts`),
-- que insere o torto **por fora da nossa validação** — exatamente o caminho que o trigger cobre.
-- Teste que só exercitasse a porta teria passado verde com este furo aberto.
--
-- ═══ ⛔ POR QUE UMA MIGRATION NOVA, E NÃO UM ACERTO NA DE HOJE ═══
--
-- A `20261014190000_stock_so_espaco_nao_e_escolha` **já está aplicada em prod** — migration
-- aplicada não se reescreve, o checksum do Prisma reprova o deploy (a cicatriz de 04/10). E
-- `CREATE OR REPLACE FUNCTION` é CREATE-only: o guard de isolamento do estoque
-- (`migration-isolation.test.ts`) reprova `ALTER TABLE`/`DROP`, não isto — e os TRIGGERS de lá
-- continuam de pé, apontando pra esta função nova de graça (eles amarram pelo NOME).
--
-- ⚠️ A classe de espaço em branco vai **ESCRITA POR EXTENSO** (` \t\n\r\f\v`), nunca por uma
-- classe implícita: `btrim` não aceita regex, e deixar de nomear um caractere é deixá-lo passar.
-- NBSP (U+00A0) e zero-width (U+200B) ficam de fora de propósito — `btrim` trabalha em caracteres
-- e cada um a mais é uma decisão; quem os pega é o `trim()` do JS na porta, que é o caminho real
-- de digitação. ⭐ Então a assimetria **continua existindo e continua na direção segura** (a porta
-- é mais estrita que o banco); o que ela deixou de ser é um buraco pro espaço em branco COMUM.
--
-- ⭐ REGRA 13 INTACTA: o `IS NULL` segue explícito e ANTES da comparação de conteúdo.
-- `length(btrim(NULL, …))` é NULL, não 0 — e NULL contamina o `IF`, que não entra, e o torto
-- PASSA. É o furo do `chk_aviso_acao_completa` (04/10), e ele não muda de natureza por eu ter
-- trocado o `trim` pelo `btrim`.
--
-- ROLLBACK: reaplicar o corpo da `20261014190000` (o `trim(valor)` simples) por
--           CREATE OR REPLACE FUNCTION stock_texto_de_escolha() … — os triggers não se tocam.

CREATE OR REPLACE FUNCTION stock_texto_de_escolha() RETURNS trigger AS $$
DECLARE
  coluna TEXT := TG_ARGV[0];
  valor  TEXT;
  limpo  TEXT;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', coluna) INTO valor USING NEW;

  -- ⛔⛔⛔ REGRA 13 — O `IS NULL` VEM EXPLÍCITO E **ANTES** DA COMPARAÇÃO DE CONTEÚDO.
  --
  -- ⚠️ Hoje as duas colunas são `NOT NULL`, então este ramo é REDUNDANTE — e é justamente por
  -- isso que ele está escrito: a migration que um dia tornar a coluna nullable não vai lembrar
  -- de revisar este trigger. E aqui NULL é um FATO ("não há texto"), não "não dá pra conferir":
  -- o erro seguro é RECUSAR, porque linha sem o texto não casa com nada depois.
  IF valor IS NULL THEN
    RAISE EXCEPTION
      'TEXTO DE ESCOLHA VAZIO: a coluna "%" de % chegou NULL. Espaço em branco (ou ausência) não é uma escolha — uma linha dessas não casa com nada depois. Mande o valor de verdade.',
      coluna, TG_TABLE_NAME;
  END IF;

  -- ⭐ A CLASSE DE ESPAÇO EM BRANCO, ESCRITA POR EXTENSO: espaço · tab · newline · carriage
  -- return · form feed · vertical tab. `btrim` não aceita regex — caractere que não está aqui
  -- é caractere que passa, e foi assim que `'\t'` entrou por fora da porta.
  limpo := btrim(valor, E' \t\n\r\f\v');

  IF length(limpo) = 0 THEN
    RAISE EXCEPTION
      'TEXTO DE ESCOLHA SÓ-ESPAÇO: a coluna "%" de % chegou com %L — só espaço em branco (espaço, tab ou quebra de linha). O CHECK `<> ''''` só pega a string vazia; espaço em branco não é uma escolha, e uma linha dessas não casa com nada depois.',
      coluna, TG_TABLE_NAME, valor;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
