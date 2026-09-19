-- ⭐ QUARENTENA DO IMPORT DE VENDAS (19/09/2026) — CREATE-only, aditiva pura.
-- O mesmo desenho do rawOfxBlob (extrato) e da fatura_quarentena (cartão): toda tentativa
-- guarda o texto; a recusada pra diagnosticar sem pedir o arquivo, a que FECHA como golden.
-- ROLLBACK: DROP TABLE "stock_venda_quarentena";
CREATE TABLE "stock_venda_quarentena" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "relatorio" TEXT NOT NULL,
  "desfecho" TEXT NOT NULL,
  "data" TEXT,
  "motivo" TEXT,
  "texto" TEXT NOT NULL,
  "linhas" INTEGER NOT NULL DEFAULT 0,
  "nomeArquivo" TEXT,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "textoPurgadoEm" TIMESTAMP(3),
  CONSTRAINT "stock_venda_quarentena_pkey" PRIMARY KEY ("id"),
  -- ⛔ vocabulário fechado: relatório/desfecho fora da lista é chamada errada, não dado novo
  CONSTRAINT "chk_venda_quarentena_relatorio" CHECK ("relatorio" IN ('PRODUTOS','COMPLEMENTOS')),
  CONSTRAINT "chk_venda_quarentena_desfecho" CHECK ("desfecho" IN ('OK','RECUSADA'))
);

CREATE INDEX "stock_venda_quarentena_companyId_criadoEm_idx" ON "stock_venda_quarentena"("companyId", "criadoEm");
CREATE INDEX "stock_venda_quarentena_desfecho_criadoEm_idx" ON "stock_venda_quarentena"("desfecho", "criadoEm");
