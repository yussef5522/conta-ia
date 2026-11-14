-- ROTINAS (lei docs/rotinas-referencia.html, R25–R31, 13/11/2026). Autorização nominal do dono no sprint.
--
-- 100% ADITIVA PURA: só CREATE TABLE/INDEX de 4 tabelas NOVAS. Nenhuma tabela existente é alterada
-- (as FKs moram nas tabelas novas; `stock_tarefa` não ganha coluna) — não há seção de ALTERs em dado real.
-- ⛔ Nenhum dado pessoal de cliente.

CREATE TABLE "stock_rotina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "regra" TEXT NOT NULL,
    "limiteMin" INTEGER,
    "colaboradorId" TEXT,
    "pausadaEm" TIMESTAMP(3),
    "pausadaPorId" TEXT,
    "excluidaEm" TIMESTAMP(3),
    "excluidaPorId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_rotina_pkey" PRIMARY KEY ("id"),
    -- ⛔ REGRA 13: IS NOT NULL explícito e primeiro
    CONSTRAINT "chk_stock_rotina_nome" CHECK ("nome" IS NOT NULL AND length(trim("nome")) > 0),
    CONSTRAINT "chk_stock_rotina_regra" CHECK ("regra" IS NOT NULL AND length(trim("regra")) > 0),
    -- limite é minuto do dia, ou nada (NULL passa por construção: sem limite = nunca atrasa)
    CONSTRAINT "chk_stock_rotina_limite" CHECK ("limiteMin" IS NULL OR ("limiteMin" >= 0 AND "limiteMin" <= 1439)),
    -- ⛔ pausar/excluir pela metade (sem autor ou sem instante) é impossível
    CONSTRAINT "chk_stock_rotina_pausada" CHECK (("pausadaEm" IS NULL) = ("pausadaPorId" IS NULL)),
    CONSTRAINT "chk_stock_rotina_excluida" CHECK (("excluidaEm" IS NULL) = ("excluidaPorId" IS NULL))
);
CREATE INDEX "stock_rotina_companyId_excluidaEm_idx" ON "stock_rotina"("companyId", "excluidaEm");

CREATE TABLE "stock_rotina_item" (
    "id" TEXT NOT NULL,
    "rotinaId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    CONSTRAINT "stock_rotina_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_rotina_item_texto" CHECK ("texto" IS NOT NULL AND length(trim("texto")) > 0),
    CONSTRAINT "stock_rotina_item_rotinaId_fkey" FOREIGN KEY ("rotinaId") REFERENCES "stock_rotina"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_rotina_item_rotinaId_posicao_key" ON "stock_rotina_item"("rotinaId", "posicao");

-- ⭐⭐ a IDEMPOTÊNCIA da semeadura (R25) mora no índice único (rotinaId, dia)
CREATE TABLE "stock_tarefa_rotina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "rotinaId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "limiteMin" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_tarefa_rotina_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_tarefa_rotina_limite" CHECK ("limiteMin" IS NULL OR ("limiteMin" >= 0 AND "limiteMin" <= 1439)),
    CONSTRAINT "stock_tarefa_rotina_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "stock_tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- ⛔ rotina com história nunca se apaga (R29: some das telas, as tarefas ficam)
    CONSTRAINT "stock_tarefa_rotina_rotinaId_fkey" FOREIGN KEY ("rotinaId") REFERENCES "stock_rotina"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_tarefa_rotina_tarefaId_key" ON "stock_tarefa_rotina"("tarefaId");
CREATE UNIQUE INDEX "stock_tarefa_rotina_rotinaId_dia_key" ON "stock_tarefa_rotina"("rotinaId", "dia");
CREATE INDEX "stock_tarefa_rotina_companyId_dia_idx" ON "stock_tarefa_rotina"("companyId", "dia");

CREATE TABLE "stock_tarefa_item" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "feitoEm" TIMESTAMP(3),
    "feitoPorId" TEXT,
    CONSTRAINT "stock_tarefa_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_stock_tarefa_item_texto" CHECK ("texto" IS NOT NULL AND length(trim("texto")) > 0),
    -- ⛔ (R26) tique sem quem assina é impossível no banco (e quem sem instante também)
    CONSTRAINT "chk_stock_tarefa_item_tique" CHECK (("feitoEm" IS NULL) = ("feitoPorId" IS NULL)),
    CONSTRAINT "stock_tarefa_item_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "stock_tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stock_tarefa_item_tarefaId_posicao_key" ON "stock_tarefa_item"("tarefaId", "posicao");
CREATE INDEX "stock_tarefa_item_companyId_tarefaId_idx" ON "stock_tarefa_item"("companyId", "tarefaId");
