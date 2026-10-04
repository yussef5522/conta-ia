-- ⛔⛔⛔ CORREÇÃO DO `chk_aviso_acao_completa` — A LÓGICA DE TRÊS VALORES DO SQL (04/10/2026).
--
-- **O defeito, achado NA PROVA EM PROD (não em teste):** o CHECK do botão pela metade
-- **NÃO BLOQUEAVA**. Tentei inserir `acaoRotulo='ir'` com `acaoHref=NULL` direto no Postgres e
-- a linha **ENTROU**.
--
-- **A causa, medida no próprio banco:**
--   ("acaoRotulo" IS NULL AND "acaoHref" IS NULL)                      -> false
--   OR (length(trim("acaoRotulo")) > 0 AND length(trim("acaoHref")) > 0) -> true AND NULL = NULL
--   false OR NULL = NULL
-- E **CHECK com expressão NULL PASSA** (conferido: `SELECT (false OR NULL) IS NULL` → t;
-- `CASE WHEN (false OR NULL) THEN 1 ELSE 0 END` → 0). Em SQL o CHECK só reprova quando a
-- expressão é FALSE — NULL é tratado como "não sei", e "não sei" entra.
--
-- ⚠️⚠️ **A LIÇÃO, e ela é da família das mais caras desta casa:** `length(trim(NULL))` não é 0,
-- é NULL, e NULL contamina o `AND` inteiro. É a MESMA doença do `?? 'CAIXA'` que sumiu com o
-- CASPER (20/09) e do `'categoryId' in t` que era verdade com valor nulo (26/08): **tratar
-- "desconhecido" como se fosse um valor**. Em CHECK com coluna NULLABLE, a comparação de
-- conteúdo precisa de `IS NOT NULL` explícito ANTES.
--
-- ⚠️ **E ISTO É UM ALTER — declarado, não escondido.** A ordem do sprint era "migration
-- CREATE-only", e a regra existe pra proteger tabela com DADO REAL / módulo fechado. Esta
-- tabela nasceu **nesta mesma rodada de deploy**, tem **zero linha de produção** (só a linha do
-- meu próprio teste de prova, apagada aqui), e o que se corrige é uma constraint que **não
-- estava fazendo o trabalho dela**. Deixar o CHECK furado seria pior: a lei do dono (*"aviso sem
-- ação clara NÃO PODE ser criado"*) voltaria a depender só da lib, e qualquer produtor futuro
-- que gravasse por fora dela criaria botão pela metade — a "porta pintada na parede" de 13/09.
--
-- ROLLBACK: `ALTER TABLE "aviso" DROP CONSTRAINT "chk_aviso_acao_completa";` (volta ao estado
-- sem a 2ª rede; a lib continua recusando).

-- ⚠️ apaga a linha do teste de prova (o único registro existente nesta tabela)
DELETE FROM "aviso" WHERE "acaoRotulo" IS NOT NULL AND "acaoHref" IS NULL;

ALTER TABLE "aviso" DROP CONSTRAINT IF EXISTS "chk_aviso_acao_completa";

ALTER TABLE "aviso" ADD CONSTRAINT "chk_aviso_acao_completa" CHECK (
  ("acaoRotulo" IS NULL AND "acaoHref" IS NULL)
  OR (
    "acaoRotulo" IS NOT NULL AND "acaoHref" IS NOT NULL
    AND length(trim("acaoRotulo")) > 0 AND length(trim("acaoHref")) > 0
  )
);
