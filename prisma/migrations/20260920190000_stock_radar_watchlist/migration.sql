-- ⭐⭐ RADAR DO ESTOQUE — AS DUAS LISTAS QUE O DONO VIGIA (20/09/2026)
--
-- ⛔ ISOLAMENTO DO MÓDULO (a regra dura desde a Fase 0): migration de estoque SÓ CRIA, e
-- toda tabela nasce com o prefixo `stock_`. Nada de ALTER em tabela existente; `companyId`
-- é VALOR indexado, SEM @relation — o multi-tenant é do app + do juiz (E11).
CREATE TABLE "stock_radar_watchlist" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  -- CAROS = matéria-prima cara · PORCOES = o que a cozinha produz
  "lista"     TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criadoPorId"  TEXT,
  CONSTRAINT "stock_radar_watchlist_pkey" PRIMARY KEY ("id"),
  -- ⭐ CAMADA 1: lista fora do vocabulário é IMPOSSÍVEL, não "checada no app"
  CONSTRAINT "chk_stock_radar_lista" CHECK ("lista" IN ('CAROS','PORCOES'))
);

-- ⛔ o mesmo item duas vezes na mesma lista é impossível no BANCO: sem isto, dois toques
-- rápidos no "+ adicionar" duplicariam a linha e o placar somaria o item 2×.
CREATE UNIQUE INDEX "stock_radar_watchlist_unica" ON "stock_radar_watchlist"("companyId","lista","itemId");
CREATE INDEX "stock_radar_watchlist_por_empresa" ON "stock_radar_watchlist"("companyId","lista");
