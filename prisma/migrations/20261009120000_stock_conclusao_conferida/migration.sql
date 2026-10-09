-- ⭐⭐⭐ A CONFERÊNCIA DO GERENTE — QUATRO OLHOS NA CONCLUSÃO (09/10/2026).
-- CREATE-only, ADITIVA PURA. Zero ALTER, zero DROP.
--
-- **Ordem do dono:** *"Conclusão nasce no estado AGUARDANDO_CONFERENCIA … CONFIRMAR = 1 toque
-- + PIN → ✓✓ (carimbo: quem conferiu + hora); CORRIGIR = novo número + motivo + PIN → nova
-- VERSÃO com rastro. REGRA DURA: conferente ≠ declarante, SEMPRE — nem gerente confere a
-- própria conclusão (guard + CHECK)."*
--
-- ⭐⭐ O ESTADO NÃO É COLUNA — ELE É DERIVADO DESTA TABELA. Duas razões, e as duas já
-- custaram caro nesta casa:
--   1. `stock_producao_conclusao` já existe e o isolamento do módulo **proíbe ALTER**
--      (migration de estoque é CREATE-only desde a Fase 0, com guard de CI).
--   2. ⛔ E mesmo se desse, **campo de estado gravado envelhece**: foi assim que a
--      `CreditCardInvoice.status` ficou eternamente `OPEN` depois de vencer, porque ninguém
--      a transiciona com o tempo. "Tem linha aqui?" não envelhece nunca.
--
-- ⭐ E DERIVAR ATENDE "NADA TRAVA A COZINHA" DE GRAÇA (decisão do dono): a conclusão nasce,
-- a baixa acontece, a etiqueta sai — e o estado *aguardando* existe por AUSÊNCIA de carimbo,
-- sem nenhum passo novo no caminho de quem declara.
--
-- ⛔⛔⛔ AS DUAS IDENTIDADES, E POR QUE SÃO DUAS (o retrato do item 0 decidiu isto):
--
--   `conferidoPorId`            = o USUÁRIO da sessão  → prova o **PAPEL** (`stock.manage`)
--   `conferidoPorColaboradorId` = o COLABORADOR do PIN → prova a **PESSOA** presente
--
-- Medido em prod: os PINs são de `stock_colaborador`, que tem **nome e ativo, mais nada** —
-- **nenhum vínculo com usuário** (0 de 19 colaboradores têm nome que case com um usuário), e
-- o próprio `pin.ts` declara que o PIN *"identifica, não autentica"*. Então "PIN de quem tem
-- papel de gerência" **não existe hoje**; quem carrega papel é a sessão. E 397 das 448
-- conclusões vêm do TABLET (colaborador, sem usuário): sem o PIN do conferente, o
-- "conferente ≠ declarante" dessas 397 seria **incomparável**, porque estaria comparando
-- espaços de identidade diferentes.
--
-- ⚠️ E O PIN É O QUE DÁ O QUARTO OLHO DE VERDADE: com só a sessão, uma aba de gerente aberta
-- no tablet da cozinha faria "quatro olhos" virar dois.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_conclusao_conferida";

CREATE TABLE "stock_conclusao_conferida" (
  "id"                        TEXT NOT NULL,
  "companyId"                 TEXT NOT NULL,
  "conclusaoId"               TEXT NOT NULL,

  -- quem carimbou: papel (sessão) + pessoa (PIN). Os dois obrigatórios.
  "conferidoPorId"            TEXT NOT NULL,
  "conferidoPorColaboradorId" TEXT NOT NULL,
  -- ⚠️ SNAPSHOT do nome: o selo da lista diz "✓✓ conferido · Cristian" sem depender de join,
  --    e continua dizendo a verdade no dia em que o colaborador for renomeado ou desativado
  "conferidoPorNome"          TEXT NOT NULL,

  -- contra QUEM a regra dura morde — snapshot, porque é ele que o CHECK compara
  "declaradoPorColaboradorId" TEXT,
  "declaradoPorId"            TEXT,

  -- ⭐ a CORREÇÃO: o número que o declarante havia posto + o motivo. `null` nos dois = o
  --    gerente confirmou sem mudar nada.
  "corrigiuDe"                DOUBLE PRECISION,
  "motivoDaCorrecao"          TEXT,

  "conferidoEm"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_conclusao_conferida_pkey" PRIMARY KEY ("id"),

  -- ⛔ FORMA: string em branco passaria por um `length(x) > 0` sem o trim, e o selo
  --    mostraria "conferido · " sem nome nenhum
  CONSTRAINT "chk_conferida_conclusao" CHECK (length(trim("conclusaoId")) > 0),
  CONSTRAINT "chk_conferida_quem"      CHECK (length(trim("conferidoPorId")) > 0
                                          AND length(trim("conferidoPorColaboradorId")) > 0
                                          AND length(trim("conferidoPorNome")) > 0),

  -- ⛔⛔⛔ A REGRA DURA NO BANCO: CONFERENTE ≠ DECLARANTE.
  --
  -- ⚠️⚠️ REGRA 13 — LÓGICA DE TRÊS VALORES, e é aqui que o `chk_aviso_acao_completa` de
  -- 04/10 furou. `"conferidoPorColaboradorId" <> "declaradoPorColaboradorId"` com o
  -- declarante NULL avalia pra **NULL**, e ***CHECK com expressão NULL PASSA*** — a trava
  -- existiria no papel e deixaria passar exatamente a linha que não tem declarante.
  -- Por isso o `IS NULL` vem **EXPLÍCITO e PRIMEIRO**: sem declarante conhecido não há
  -- auto-conferência a barrar (e aí passar é o certo); com declarante, compara.
  CONSTRAINT "chk_conferida_nao_e_o_declarante_colab" CHECK (
    "declaradoPorColaboradorId" IS NULL
    OR "conferidoPorColaboradorId" <> "declaradoPorColaboradorId"
  ),
  -- o mesmo no eixo do USUÁRIO — cobre o gerente que concluiu pela tela de Produção
  CONSTRAINT "chk_conferida_nao_e_o_declarante_user" CHECK (
    "declaradoPorId" IS NULL
    OR "conferidoPorId" <> "declaradoPorId"
  ),

  -- ⛔⛔ MEIA-CORREÇÃO É IMPOSSÍVEL: número novo sem motivo seria um ajuste de produção sem
  -- porquê, e em três meses ninguém sabe se a cozinha contou errado ou se alguém "arrumou"
  -- o número. ⚠️ REGRA 13 de novo: `length(trim(NULL))` **não é 0, é NULL** — então o
  -- `IS NOT NULL` precede o teste de conteúdo, senão o par (número, motivo em branco)
  -- passaria.
  CONSTRAINT "chk_conferida_correcao_completa" CHECK (
    ("corrigiuDe" IS NULL AND "motivoDaCorrecao" IS NULL)
    OR ("corrigiuDe" IS NOT NULL
        AND "motivoDaCorrecao" IS NOT NULL
        AND length(trim("motivoDaCorrecao")) > 0)
  )
);

-- ⛔ UMA conclusão, UM carimbo — conferir duas vezes é IMPOSSÍVEL, não "checado". Sem isto,
--    dois gerentes no mesmo minuto (ou dois toques no celular) empilhariam carimbos e o selo
--    diria "conferido" duas vezes, cada um com um nome.
CREATE UNIQUE INDEX "stock_conclusao_conferida_key"
  ON "stock_conclusao_conferida"("conclusaoId");
-- a fila do gerente lê por empresa + data
CREATE INDEX "stock_conclusao_conferida_empresa_idx"
  ON "stock_conclusao_conferida"("companyId", "conferidoEm");
