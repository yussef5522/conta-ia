-- ⭐⭐⭐ O CARIMBO PELA SESSÃO — SEM PIN (09/10/2026, ordem do dono no mesmo dia).
-- CREATE-only, ADITIVA PURA. Zero ALTER, zero DROP.
--
-- **Ordem do dono (defeito de estreia):** *"ao Confirmar, a tela pede PIN da conta do gerente —
-- Yussef/marcyelle/cristian não têm PIN e NÃO devem ter: PIN é identidade dos colaboradores no
-- tablet COMPARTILHADO; gerente entra com login próprio, e a SESSÃO é a assinatura. O prompt de
-- PIN SAI do fluxo de carimbo (morre na tela e na rota — não fica opcional)."*
--
-- ⛔⛔⛔ POR QUE UMA TABELA NOVA, E NÃO UM ALTER NA DE HOJE À TARDE:
--   A `stock_conclusao_conferida` nasceu com **`conferidoPorColaboradorId` NOT NULL** (o PIN era
--   obrigatório por desenho) e com um CHECK exigindo conteúdo nele. Carimbar pela sessão é
--   justamente **não ter colaborador** → a coluna NOT NULL quebraria em TODO carimbo.
--   ⛔ `ALTER TABLE` é proibido em migration de estoque desde a Fase 0 (guard de CI
--      `migration-isolation.test.ts`, e o artefato É o arquivo .sql);
--   ⛔ reescrever a migration de hoje também não serve: **migration já aplicada não se reescreve**
--      — o checksum do Prisma reprova o deploy (a cicatriz de 04/10).
--   ⭐ E gravar o userId na coluna do colaborador seria pior que as duas: ela significa *"o
--      colaborador do PIN"*, e o CHECK passaria a comparar um `userId` com um `colaboradorId` —
--      espaços de identidade diferentes, que **nunca** são iguais. O eixo viraria um no-op que
--      PARECE trava. *Comentário que promete ser a trava sem ser a trava é pior que nenhum.*
--
-- ⚠️⚠️ CONSEQUÊNCIA REGISTRADA, NÃO ESCONDIDA: a `stock_conclusao_conferida` fica no banco
-- **vazia e sem leitor** (medido em prod antes desta migration: **0 linhas** — ela nunca
-- carimbou nada). O `DROP` é proibido pelo guard, e afrouxar o guard por conveniência seria
-- trocar risco real por arrumação. Fica como débito nomeado.
--
-- ⛔⛔ E O QUE A REGRA DURA PERDE E O QUE ELA MANTÉM — medido, não suposto:
--   · **o eixo do USUÁRIO fica DURO**: `conferidoPorId` (a sessão) × `declaradoPorId` — é ele
--     que barra o gerente que concluiu pela tela de Produção e depois tenta se auto-carimbar;
--   · **o eixo do COLABORADOR fica INERTE**, porque o conferente deixou de ter identidade de
--     colaborador. A coluna `declaradoPorColaboradorId` CONTINUA gravada (é rastro, e é o lado
--     esquerdo da comparação no dia em que existir vínculo colaborador↔usuário), mas não há
--     CHECK comparando: comparar com NULL seria a lógica de três valores devolvendo NULL, e
--     ***CHECK com expressão NULL PASSA*** — uma trava de papel.
--   ⚠️ O flanco que isso abre está no relatório, com nome: uma pessoa que seja colaborador no
--     tablet **e** usuário de gerência pode declarar com o PIN e carimbar com o login, e nada
--     barra — porque `stock_colaborador` não aponta pra `User` (0 de 19 nomes casam, e nome não
--     é identidade). A saída é o vínculo, que é decisão do dono.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_conclusao_carimbo";

CREATE TABLE "stock_conclusao_carimbo" (
  "id"                        TEXT NOT NULL,
  "companyId"                 TEXT NOT NULL,
  "conclusaoId"               TEXT NOT NULL,

  -- ⭐ QUEM CARIMBOU = O USUÁRIO DA SESSÃO. O papel (`stock.manage`) é checado na rota; esta
  --    coluna é a ASSINATURA: o login pessoal de quem conferiu.
  "conferidoPorId"            TEXT NOT NULL,
  -- ⚠️ SNAPSHOT do nome: o selo diz "✓✓ conferido · Cristian" sem join, e continua dizendo a
  --    verdade no dia em que o usuário for renomeado ou sair da empresa
  "conferidoPorNome"          TEXT NOT NULL,

  -- contra QUEM a regra dura morde — snapshot dos dois eixos do DECLARANTE
  "declaradoPorId"            TEXT,
  "declaradoPorColaboradorId" TEXT,

  -- ⭐ a CORREÇÃO: o número que o declarante havia posto + o motivo. `null` nos dois = o
  --    gerente confirmou sem mudar nada.
  "corrigiuDe"                DOUBLE PRECISION,
  "motivoDaCorrecao"          TEXT,

  "conferidoEm"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_conclusao_carimbo_pkey" PRIMARY KEY ("id"),

  -- ⛔ FORMA: string em branco passaria por um `length(x) > 0` sem o trim, e o selo mostraria
  --    "conferido · " sem nome nenhum
  CONSTRAINT "chk_carimbo_conclusao" CHECK (length(trim("conclusaoId")) > 0),
  CONSTRAINT "chk_carimbo_quem"      CHECK (length(trim("conferidoPorId")) > 0
                                        AND length(trim("conferidoPorNome")) > 0),

  -- ⛔⛔⛔ A REGRA DURA NO BANCO, NO EIXO DA SESSÃO: quem assinou ≠ quem lançou.
  --
  -- ⚠️⚠️ REGRA 13 — LÓGICA DE TRÊS VALORES. `"conferidoPorId" <> "declaradoPorId"` com o
  -- declarante NULL avalia pra **NULL**, e ***CHECK com expressão NULL PASSA*** — a trava
  -- existiria no papel e deixaria passar exatamente a linha sem declarante. Por isso o
  -- `IS NULL` vem **EXPLÍCITO e PRIMEIRO**: sem declarante-usuário conhecido não há
  -- auto-conferência a barrar (e aí passar é o certo); com declarante, compara.
  CONSTRAINT "chk_carimbo_nao_e_o_declarante_user" CHECK (
    "declaradoPorId" IS NULL
    OR "conferidoPorId" <> "declaradoPorId"
  ),

  -- ⛔⛔ MEIA-CORREÇÃO É IMPOSSÍVEL: número novo sem motivo seria um ajuste de produção sem
  -- porquê, e em três meses ninguém sabe se a cozinha contou errado ou se alguém "arrumou" o
  -- número. ⚠️ REGRA 13 de novo: `length(trim(NULL))` **não é 0, é NULL** — então o
  -- `IS NOT NULL` precede o teste de conteúdo, senão o par (número, motivo em branco) passaria.
  CONSTRAINT "chk_carimbo_correcao_completa" CHECK (
    ("corrigiuDe" IS NULL AND "motivoDaCorrecao" IS NULL)
    OR ("corrigiuDe" IS NOT NULL
        AND "motivoDaCorrecao" IS NOT NULL
        AND length(trim("motivoDaCorrecao")) > 0)
  )
);

-- ⛔ UMA conclusão, UM carimbo — conferir duas vezes é IMPOSSÍVEL, não "checado". Sem isto,
--    dois gerentes no mesmo minuto (ou dois toques no celular) empilhariam carimbos e o selo
--    diria "conferido" duas vezes, cada um com um nome.
CREATE UNIQUE INDEX "stock_conclusao_carimbo_key"
  ON "stock_conclusao_carimbo"("conclusaoId");
-- a fila do gerente lê por empresa + data
CREATE INDEX "stock_conclusao_carimbo_empresa_idx"
  ON "stock_conclusao_carimbo"("companyId", "conferidoEm");
