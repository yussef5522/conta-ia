-- ⭐ O PEDIDO (a meta em unidades) DA ORDEM DE PRODUÇÃO (13/09/2026) — CREATE-only.
--
-- "pedido 130 → entregue 137 UN (105%)" — o mock. E, quando não houver: "sem meta
-- registrada · entregue N (nunca inventar)".
--
-- ⛔ POR QUE UMA META REGISTRADA E NÃO DERIVADA: a ordem só guarda `escalaReceitas` (o
-- múltiplo do lote base). Derivar o "pedido" de `escala × rendimento médio` faria o
-- rendimento comparar o REAL com a média do próprio real — daria ~100% sempre, uma métrica
-- circular e inútil, exatamente a que o Crunchtime existe pra não ser.
--
-- ROLLBACK: DROP TABLE "stock_ordem_meta";
CREATE TABLE "stock_ordem_meta" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "ordemId"       TEXT NOT NULL,
  "unidades"      DOUBLE PRECISION NOT NULL,
  "registradoPorId" TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_ordem_meta_pkey" PRIMARY KEY ("id"),
  -- ⛔ meta zero ou negativa não é um pedido
  CONSTRAINT "chk_meta_positiva" CHECK ("unidades" > 0)
);
-- uma meta por ordem: registrar de novo SUBSTITUI (o dono corrigiu o pedido)
CREATE UNIQUE INDEX "stock_ordem_meta_ordem_key" ON "stock_ordem_meta"("companyId", "ordemId");
