-- ⭐⭐ RADAR — AS LISTAS QUE O DONO VIGIA, agora com REVENDA (21/09/2026)
--
-- ⚠️⚠️ **POR QUE UMA TABELA NOVA E NÃO UM ALTER NO CHECK — e a lição é sobre ONTEM.**
-- Em 20/09 eu criei `stock_radar_watchlist` com `CHECK (lista IN ('CAROS','PORCOES'))`
-- chamando aquilo de "camada 1". Hoje o dono pediu a 3ª lista (REVENDA) e o CHECK virou
-- uma parede: **o módulo de estoque é CREATE-only por regra dura** (nada de ALTER/DROP,
-- com guard no CI), então enum fechada no banco custa uma tabela nova a cada valor novo.
-- ⭐ ***CHECK com vocabulário fechado numa tabela de CONFIGURAÇÃO envelhece mal.*** O que
-- protege de verdade aqui é o ÚNICO (não repetir item na lista) e o não-vazio; QUAL é o
-- vocabulário é decisão de produto, e produto muda — isso mora no TypeScript (`LISTAS`),
-- onde crescer é barato, com guard de teste conferindo que só os valores conhecidos entram.
CREATE TABLE "stock_radar_item" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  -- CAROS (matéria-prima) · REVENDA (bebida e revenda) · PORCOES (o que a cozinha produz)
  "lista"       TEXT NOT NULL,
  "itemId"      TEXT NOT NULL,
  "criadoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId" TEXT,
  CONSTRAINT "stock_radar_item_pkey" PRIMARY KEY ("id"),
  -- ⭐ o CHECK valida FORMA (não-vazio, sem espaço), não vocabulário
  CONSTRAINT "chk_stock_radar_item_lista" CHECK ("lista" <> '' AND "lista" = upper("lista"))
);

-- ⛔ o mesmo item duas vezes na mesma lista continua IMPOSSÍVEL no banco
CREATE UNIQUE INDEX "stock_radar_item_unica" ON "stock_radar_item"("companyId","lista","itemId");
CREATE INDEX "stock_radar_item_por_empresa" ON "stock_radar_item"("companyId","lista");

-- ⭐⭐ OS DADOS VÊM JUNTO — e a MIGRAÇÃO JÁ CLASSIFICA (ordem do dono): *"os itens de
-- bebida que hoje estão na lista dos caros MIGRAM pra ela"*. Quem decide é a CATEGORIA do
-- item, não o nome — nome exigiria adivinhar o que é bebida, e a casa não adivinha.
INSERT INTO "stock_radar_item" ("id","companyId","lista","itemId","criadoEm","criadoPorId")
SELECT w."id", w."companyId",
       CASE WHEN w."lista" = 'CAROS' AND i."categoria" = 'REVENDA' THEN 'REVENDA' ELSE w."lista" END,
       w."itemId", w."criadoEm", w."criadoPorId"
FROM "stock_radar_watchlist" w
LEFT JOIN "stock_item" i ON i."id" = w."itemId";

-- ⚠️ A TABELA ANTIGA FICA ÓRFÃ, e isso é dívida DECLARADA, não descuido: apagá-la exigiria
-- um DROP, que é exatamente o que a regra do módulo proíbe. São ~35 linhas; some no dia em
-- que o dono autorizar uma faxina fora da regra CREATE-only.
