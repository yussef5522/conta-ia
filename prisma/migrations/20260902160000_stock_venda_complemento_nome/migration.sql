-- ⭐⭐ CATÁLOGO DE NOMES DE COMPLEMENTO — a LISTA DE TRABALHO do dono (02/09/2026).
--
-- ⛔ POR QUE ELE EXISTE: a prateleira nascia das LINHAS de venda, então apagar imports
-- (ou reimportar um dia menor) fazia **o nome sumir da tela**. O dono: *"os nomes são
-- minha lista de trabalho"*. Nome conhecido e venda são coisas diferentes:
--   linha de venda = quantas vezes saiu NAQUELE dia (dado que envelhece, some no reimport)
--   catálogo       = este nome EXISTE no PDV (não envelhece, não some)
--
-- ⚠️ Sem esta tabela, "apagar as vendas velhas" custaria a lista inteira de trabalho —
-- foi medido: com 1 mapeamento, a aba ficaria com 1 nome de 215.
--
-- ⛔ CREATE-only (isolamento do módulo, guard de CI). ROLLBACK:
--    DROP TABLE "stock_venda_complemento_nome";
CREATE TABLE "stock_venda_complemento_nome" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "companyId"    TEXT NOT NULL,
  "nomeSuitable" TEXT NOT NULL,
  -- quando o nome foi visto pela 1ª e pela última vez num relatório importado
  "primeiroEm"   TIMESTAMP(3) NOT NULL,
  "ultimoEm"     TIMESTAMP(3) NOT NULL,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_complemento_nome_vazio" CHECK (length(trim("nomeSuitable")) > 0)
);

CREATE UNIQUE INDEX "stock_venda_complemento_nome_company_nome_key"
  ON "stock_venda_complemento_nome" ("companyId", "nomeSuitable");
CREATE INDEX "stock_venda_complemento_nome_companyId_idx"
  ON "stock_venda_complemento_nome" ("companyId");
