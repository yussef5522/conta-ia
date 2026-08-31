-- ⭐⭐ CONTAGEM — RASTRO, REVISÃO E CAMINHO FÍSICO (31/08/2026). CREATE-only.
--
-- ⚠️ POR QUE TABELAS NOVAS E NÃO COLUNAS: o isolamento do módulo proíbe ALTER (guard de
-- CI). E isso empurrou pro desenho certo, que é o mesmo do ledger: **cabeça + histórico**.
-- `stock_contagem_item` continua sendo o valor ATUAL (é o que o invariante E8 e o ajuste
-- no ledger já leem, e não se toca); aqui mora o que aconteceu ao longo do caminho.
--
-- ⭐ `stock_contagem_versao` é APPEND-ONLY: recontar não sobrescreve, empilha. É o que
-- responde "quem contou, quando, quanto, e o que tinha antes" sem depender de auditoria
-- externa.
--
-- ⚠️⚠️ E O RASTRO DIZ **QUEM CONTOU**, NÃO QUEM É CULPADO. Quem descobre a falta não é
-- quem causou — se contar virar risco, ninguém conta direito. Por isso o nome vive DENTRO
-- do histórico da linha, nunca colado no número da divergência.

CREATE TABLE "stock_contagem_versao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contagemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    -- CONTADO tem número; NAO_SEI e PULADO não têm, e isso é informação, não ausência
    "estado" TEXT NOT NULL,
    "qtdContada" DOUBLE PRECISION,
    -- o valor da versão anterior, desnormalizado: a revisão mostra "era 1,86" sem join
    "qtdAnterior" DOUBLE PRECISION,
    "saldoSistema" DOUBLE PRECISION NOT NULL,
    -- ⭐ CONTAGEM CEGA: ela apertou "ver o que o sistema diz" antes de digitar?
    -- Não é proibição, é escolha COM RASTRO.
    "viuSistema" BOOLEAN NOT NULL DEFAULT false,
    -- ⭐ a observação de QUEM VIU ("estava molhado", "achei em dois lugares").
    -- Observação NÃO é decisão — é o que faz o dono investigar certo depois.
    "observacao" TEXT,
    "contadoPorId" TEXT,
    "contadoPorNome" TEXT,
    "contadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_contagem_versao_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_cv_estado" CHECK ("estado" IN ('CONTADO','NAO_SEI','PULADO')),
    CONSTRAINT "chk_cv_versao" CHECK ("versao" >= 1),
    -- ⛔ CONTADO sem número, ou NAO_SEI/PULADO com número, é impossível no banco:
    -- é o que impede "branco" de voltar a ser ambíguo.
    CONSTRAINT "chk_cv_qtd" CHECK (
        ("estado" = 'CONTADO' AND "qtdContada" IS NOT NULL AND "qtdContada" >= 0)
        OR ("estado" <> 'CONTADO' AND "qtdContada" IS NULL)
    )
);
-- versão repetida pro mesmo par é impossível (a corrida entre dois celulares perde)
CREATE UNIQUE INDEX "stock_contagem_versao_unica" ON "stock_contagem_versao"("contagemId", "itemId", "versao");
CREATE INDEX "stock_contagem_versao_sessao_idx" ON "stock_contagem_versao"("companyId", "contagemId");
CREATE INDEX "stock_contagem_versao_item_idx" ON "stock_contagem_versao"("companyId", "itemId");

-- ⭐ A REVISÃO — decisão do DONO, separada da contagem (gente diferente, momento diferente)
--
-- ⚠️ "CONFERIDO" NÃO APLICA NADA, e o nome diz isso de propósito: o ajuste no ledger já
-- aconteceu na hora da contagem (decisão de 23/08 — sessão de vários dias não pode segurar
-- os ajustes reféns). Chamar de "aceitar" faria o botão MENTIR sobre o que o clique faz.
CREATE TABLE "stock_contagem_revisao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contagemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "motivo" TEXT,
    "decididoPorId" TEXT,
    "decididoPorNome" TEXT,
    "decididoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_contagem_revisao_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_crev_decisao" CHECK ("decisao" IN ('CONFERIDO','RECONTAR','INVESTIGAR'))
);
CREATE INDEX "stock_contagem_revisao_sessao_idx" ON "stock_contagem_revisao"("companyId", "contagemId");

-- ⭐⭐ O CAMINHO FÍSICO DO ESTOQUE (câmara → freezer → seco → salão)
--
-- ⚠️ NASCE AGORA, MESMO A FILA INDO POR CATEGORIA (decisão do dono, e o motivo é bom):
-- com migration CREATE-only, "deixa pra depois" vira "nunca" — a estrutura tem que existir
-- antes de alguém precisar dela.
--
-- ⚠️ E NINGUÉM PREENCHE 91 CAMPOS À MÃO: a ordem é ARRASTÁVEL na fila e o sistema guarda.
-- A primeira contagem estabelece o caminho andando.
CREATE TABLE "stock_contagem_ordem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "definidoPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_contagem_ordem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_cord_ordem" CHECK ("ordem" >= 0)
);
-- um item tem UMA posição no caminho (item novo simplesmente não tem linha e vai pro fim)
CREATE UNIQUE INDEX "stock_contagem_ordem_unica" ON "stock_contagem_ordem"("companyId", "itemId");
CREATE INDEX "stock_contagem_ordem_idx" ON "stock_contagem_ordem"("companyId", "ordem");
