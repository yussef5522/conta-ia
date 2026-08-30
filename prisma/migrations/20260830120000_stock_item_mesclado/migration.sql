-- ⭐ ITEM MESCLADO (30/08/2026) — o duplicado DEIXA DE EXISTIR como item.
--
-- Pedido do dono, e ele tem razão: "excluir duplicado = MESCLAR; e aí o duplicado some das
-- listas pra sempre — não é arquivar e juntar lixo". Arquivado e mesclado são coisas
-- DIFERENTES: o arquivado é um item de verdade que saiu de uso (aparece em "mostrar
-- arquivados", pode voltar); o mesclado **não é mais um item** — virou parte de outro.
--
-- ⚠️ Sem esta tabela os dois estados seriam o mesmo `ativo=false`, e o absorvido reapareceria
-- no Catálogo com "mostrar inativos" ligado. É o registro que permite sumir de VERDADE e
-- ainda assim responder "onde foi parar?".
--
-- ISOLAMENTO: CREATE-only, prefixo stock_, companyId é VALOR (sem @relation).
CREATE TABLE "stock_item_mesclado" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "itemId"       TEXT NOT NULL,   -- o absorvido (não é mais item)
  "mescladoEmId" TEXT NOT NULL,   -- o sobrevivente
  "nomeOriginal" TEXT NOT NULL,   -- o nome que ele tinha, pra auditoria legível
  "saldoNaEpoca" DOUBLE PRECISION NOT NULL,
  "valorNaEpoca" DOUBLE PRECISION NOT NULL,
  "criadoPorId"  TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_mesclado_pkey" PRIMARY KEY ("id"),
  -- um item só é absorvido UMA vez (a 2ª tentativa é bug, não caso de uso)
  CONSTRAINT "stock_item_mesclado_item_key" UNIQUE ("itemId"),
  -- ⛔ item não se mescla em si mesmo
  CONSTRAINT "chk_item_mesclado_diferente" CHECK ("itemId" <> "mescladoEmId")
);

CREATE INDEX "stock_item_mesclado_destino_idx" ON "stock_item_mesclado" ("companyId", "mescladoEmId");
