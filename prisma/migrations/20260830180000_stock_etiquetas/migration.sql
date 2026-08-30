-- ⭐⭐ ETIQUETAS: VALIDADE POR ESTADO + REGISTRO DE IMPRESSÃO (30/08/2026).
--
-- 1. VALIDADE POR ESTADO DE CONSERVAÇÃO. Hoje o item tem UM `validadeDias` na ficha, e
--    isso é falso na cozinha: a mesma carne dura 90 dias congelada, 3 resfriada e 1 em
--    ambiente. A etiqueta usa a validade do estado ESCOLHIDO na hora de imprimir.
--    ⚠️ Tabela nova porque o isolamento do módulo proíbe ALTER em `stock_item`.
CREATE TABLE "stock_item_validade" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "estado"    TEXT NOT NULL,   -- CONGELADO | RESFRIADO | AMBIENTE
  "dias"      INTEGER NOT NULL,
  "criadoPorId" TEXT,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_validade_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_validade_estado" CHECK ("estado" IN ('CONGELADO','RESFRIADO','AMBIENTE')),
  -- validade 0 ou negativa é etiqueta nascendo vencida: impossível por construção
  CONSTRAINT "chk_validade_dias" CHECK ("dias" > 0 AND "dias" <= 3650)
);
CREATE UNIQUE INDEX "stock_item_validade_unica" ON "stock_item_validade" ("companyId", "itemId", "estado");

-- 2. TODA ETIQUETA IMPRESSA VIRA REGISTRO. É o que alimenta o painel "vence hoje" (FEFO)
--    e o ciclo de vida da etiqueta (usada/descartada/vencida). Sem isto, "o que vence
--    amanhã?" seria adivinhação — a etiqueta sairia e o sistema não saberia que existe.
CREATE TABLE "stock_etiqueta" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "itemId"      TEXT NOT NULL,
  "produto"     TEXT NOT NULL,   -- nome no momento da impressão (o item pode ser renomeado)
  "lote"        TEXT NOT NULL,
  "estado"      TEXT NOT NULL,
  "fabricacao"  TIMESTAMP(3) NOT NULL,
  "validadeAte" TIMESTAMP(3),
  "quantidade"  DOUBLE PRECISION,
  "unidade"     TEXT,
  "colaborador" TEXT,
  "copias"      INTEGER NOT NULL DEFAULT 1,
  "jobId"       TEXT,            -- job da fila de impressão
  "situacao"    TEXT NOT NULL DEFAULT 'VALIDA', -- VALIDA | USADA | DESCARTADA | VENCIDA
  "origem"      TEXT NOT NULL,   -- PRODUCAO | MANIPULACAO | AVULSA
  "criadoPorId" TEXT,
  "criadoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_etiqueta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_etiqueta_estado" CHECK ("estado" IN ('CONGELADO','RESFRIADO','AMBIENTE')),
  CONSTRAINT "chk_etiqueta_situacao" CHECK ("situacao" IN ('VALIDA','USADA','DESCARTADA','VENCIDA')),
  CONSTRAINT "chk_etiqueta_copias" CHECK ("copias" > 0)
);
CREATE INDEX "stock_etiqueta_validade_idx" ON "stock_etiqueta" ("companyId", "situacao", "validadeAte");
CREATE INDEX "stock_etiqueta_lote_idx" ON "stock_etiqueta" ("companyId", "lote");
