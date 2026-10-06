-- ⛔⛔⛔ O RASTRO DA CONTAGEM SOBRE ITEM NEGATIVO (05/10/2026) — a lei "a contagem é a âncora".
--
-- O dono: *"+ motivo quando o item estava negativo — 1 toque: ficha errada/perda/falta
-- lançamento/não sei"*. O motivo é um FATO com AUTOR e DATA (quem contou disse o que acha que
-- causou), e por isso ganha tabela própria em vez de ir num campo de observação livre — é o
-- mesmo desenho de `stock_unidade_corrigida` e `stock_etapa_encerrada`.
--
-- ⚠️ CREATE-only (o isolamento do módulo proíbe ALTER em tabela existente), e por isso o motivo
-- NÃO entra como coluna em `stock_contagem_item`.
--
-- ⚠️⚠️ REGRA 13 — CHECK COM COLUNA NULLABLE É LÓGICA DE TRÊS VALORES: aqui `motivo`,
-- `saldoAntes` e `valorAntes` são **NOT NULL**, então nenhum NULL contamina o `AND`. Mesmo
-- assim há prova de INSERT torto contra Postgres (`scripts/prova-check-contagem-negativo.ts`):
-- CHECK não existe no schema Prisma, então o `db push` do dev NÃO o cria e a suíte não o vê.
CREATE TABLE "stock_contagem_negativo" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "contagemId"    TEXT NOT NULL,
  "itemId"        TEXT NOT NULL,
  -- o estado ANTES da contagem, congelado: é o que abre a investigação
  "saldoAntes"    DOUBLE PRECISION NOT NULL,
  "valorAntes"    DOUBLE PRECISION NOT NULL,
  "contado"       DOUBLE PRECISION NOT NULL,
  -- o que a pessoa acha que causou (lista fechada em TypeScript, nunca no CHECK — a cicatriz
  -- de 21/09, em que o vocabulário no banco virou parede em um dia)
  "motivo"        TEXT NOT NULL,
  -- a valoração que a âncora aplicou, pra o rastro explicar o dinheiro
  "baseDoCusto"   TEXT NOT NULL,
  "custoUsado"    DOUBLE PRECISION NOT NULL,
  "residuo"       DOUBLE PRECISION NOT NULL,
  "registradoPorId"   TEXT,
  "registradoPorNome" TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_contagem_negativo_pkey" PRIMARY KEY ("id"),
  -- ⛔ o banco garante a FORMA, não o vocabulário
  CONSTRAINT "chk_contagem_negativo_motivo" CHECK (length(trim("motivo")) > 0),
  CONSTRAINT "chk_contagem_negativo_base" CHECK (length(trim("baseDoCusto")) > 0),
  -- ⛔ contagem NEGATIVA não existe (a régua de `validarQuantidade`)
  CONSTRAINT "chk_contagem_negativo_contado" CHECK ("contado" >= 0),
  -- ⛔⛔ e o item TINHA que estar impossível: linha aqui sobre item são é dado que mente.
  --
  -- ⚠️⚠️ A 1ª VERSÃO ERA `saldoAntes < 0 OR valorAntes < 0` E RECUSARIA CONTAGEM LEGÍTIMA **SÓ
  -- EM PROD** — o CHECK era mais estreito que a definição de `eraNegativo`. Ela também é
  -- verdadeira quando o **custo médio é ≤ 0**, e `custoMedio = saldo > 0 ? valor/saldo : null`
  -- (`saldo.ts`), ou seja: saldo em pé com valor ZERADO. **Medido em prod (05/10): 2 itens
  -- nesse estado — `FANTA UVA 2L` (7 UN · R$ 0,00, o limbo que o M3 acusa) e `acucar`
  -- (5 · R$ 0,00).** Contar um deles criaria a linha com `valorAntes = 0`, o CHECK recusaria, e
  -- a transação da contagem inteira voltaria atrás — **"nenhum caminho termina em recusa"
  -- quebrado em produção, e invisível no dev**, porque `db push` não cria CHECK.
  --
  -- ⭐ `valorAntes <= 0` fecha exatamente a definição e não afrouxa: com saldo > 0 e valor > 0 o
  -- custo médio é positivo, então nenhuma linha nasce sobre item são.
  CONSTRAINT "chk_contagem_negativo_era_negativo" CHECK ("saldoAntes" < 0 OR "valorAntes" <= 0)
);

-- ⭐ recontar o mesmo item na mesma sessão é UPDATE da linha, nunca uma 2ª (o padrão do
--   `@@unique(contagemId,itemId)` de `stock_contagem_item`)
CREATE UNIQUE INDEX "stock_contagem_negativo_contagemId_itemId_key"
  ON "stock_contagem_negativo"("contagemId", "itemId");
CREATE INDEX "stock_contagem_negativo_companyId_criadoEm_idx"
  ON "stock_contagem_negativo"("companyId", "criadoEm");
CREATE INDEX "stock_contagem_negativo_companyId_itemId_idx"
  ON "stock_contagem_negativo"("companyId", "itemId");
