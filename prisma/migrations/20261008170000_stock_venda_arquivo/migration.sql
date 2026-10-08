-- ⭐⭐ O ARQUIVO QUE ENTROU — nome, Σ DECLARADO, quem e quando (08/10/2026).
-- CREATE-only, ADITIVA PURA. Zero ALTER, zero DROP.
--
-- ⛔⛔ NASCEU DO RETRATO, não de uma ideia. O item 0 do pedido perguntou *"o Σ DO ARQUIVO é
-- guardado em algum lugar?"* e a resposta medida foi **NÃO**:
--   · `stock_venda_import` guarda `totalLinhas`/`totalUnidades` (CONTAGEM) + autor + hora,
--     mas **não o nome do arquivo nem o Σ em R$** — o Σ em R$ só existe DERIVADO das linhas
--     gravadas, ou seja é o **Σ GRAVADO**, nunca o do ARQUIVO;
--   · os COMPLEMENTOS **não têm tabela de import nenhuma** — só as linhas, com um `importId`
--     SINTÉTICO (`comp-<companyId>-<data>`). Logo: **sem autor, sem hora, sem arquivo**.
--
-- ⚠️ Sem isto, a conferência *"Σ arquivo × Σ gravado"* da referência comparava um número com
-- ELE MESMO — circular, verde sempre, igual ao invariante de saldo que virou selo de graça em
-- 28/08. Guardando o declarado, a comparação passa a poder FALHAR, que é o que a torna útil.
--
-- ⚠️⚠️ E ELA CONSERTA UM DEFEITO MEDIDO: o re-import de produtos faz `upsert` cujo `update`
-- **não mexe em `criadoPorId`/`criadoEm`** → a tela mostraria o autor e a hora do **PRIMEIRO**
-- import do dia, não do último. Aqui a linha é reescrita a cada import, então "quem · hora"
-- conta a verdade do arquivo que está valendo.
--
-- ⭐ UMA LINHA POR (dia, relatório) — não por import: o relatório de PRODUTOS e o de
-- COMPLEMENTOS do mesmo dia são dois arquivos, com dois Σ e possivelmente dois autores, e é
-- exatamente esse PAR que a dropzone dupla e os selos leem.
--
-- ⛔ `somaValor` é NULLABLE de propósito: o relatório de complementos tem linhas a R$ 0,00
-- (sabor incluso no preço — 34% delas), então o Σ em R$ dele não é régua de nada. Quem
-- confere complemento é a CONTAGEM de ocorrências. ⚠️ `NULL` ali significa *"este relatório
-- não declara valor"*, nunca *"o arquivo somava zero"*.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_venda_arquivo";

CREATE TABLE "stock_venda_arquivo" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "data"          TIMESTAMP(3) NOT NULL,
  -- PRODUTOS | COMPLEMENTOS
  "relatorio"     TEXT NOT NULL,
  "nomeArquivo"   TEXT NOT NULL,
  -- ⚠️ o que o ARQUIVO declarava, não o que entrou: é com isto que o gravado é conferido
  "linhasArquivo" INTEGER NOT NULL,
  "somaQuantidade" INTEGER NOT NULL,
  "somaValor"     DOUBLE PRECISION,
  -- ⚠️ DIA | PERIODO — o modo do complemento, que a baixa usa pra recusar período (02/09)
  "modo"          TEXT NOT NULL DEFAULT 'DIA',
  "importadoPorId" TEXT,
  "importadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_venda_arquivo_pkey" PRIMARY KEY ("id"),
  -- ⛔ FORMA, nunca VOCABULÁRIO (a lição de 21/09: CHECK com lista fechada numa tabela de
  --    configuração virou parede em UM dia). Relatório novo entra sem migration; quem decide
  --    o vocabulário é o TypeScript.
  CONSTRAINT "chk_venda_arquivo_relatorio" CHECK (
    "relatorio" = upper("relatorio") AND length(trim("relatorio")) > 0
  ),
  CONSTRAINT "chk_venda_arquivo_modo" CHECK (
    "modo" = upper("modo") AND length(trim("modo")) > 0
  ),
  -- ⛔ nome em branco viraria "entrou: ·  · 214 linhas" na dropzone — rótulo sem conteúdo
  CONSTRAINT "chk_venda_arquivo_nome" CHECK (length(trim("nomeArquivo")) > 0),
  -- ⛔ arquivo de ZERO linha não é arquivo que entrou: é arquivo que não foi lido, e gravá-lo
  --    como declaração faria a conferência comparar o gravado contra zero e acusar o import
  CONSTRAINT "chk_venda_arquivo_linhas" CHECK ("linhasArquivo" > 0),
  CONSTRAINT "chk_venda_arquivo_qtd" CHECK ("somaQuantidade" >= 0),
  -- ⛔ REGRA 13 — coluna NULLABLE é lógica de TRÊS valores: o `IS NOT NULL` vem EXPLÍCITO e
  --    ANTES da comparação de conteúdo. `"somaValor" >= 0` sozinho devolve NULL quando a
  --    coluna é NULL, e **CHECK com expressão NULL PASSA** — o furo exato do
  --    `chk_aviso_acao_completa` de 04/10. Aqui NULL é legítimo (complementos), então a
  --    condição tem que dizer isso em vez de depender do acaso.
  CONSTRAINT "chk_venda_arquivo_valor" CHECK (
    "somaValor" IS NULL OR "somaValor" >= 0
  )
);

-- ⛔ um dia tem UM arquivo por relatório: duas linhas dariam dois Σ declarados pro mesmo dia e
--    a conferência escolheria o primeiro que viesse do banco (ordem arbitrária) — a família do
--    desempate que custou dois alarmes de ±3.026,31 no juiz de saldo em 28/08
CREATE UNIQUE INDEX "stock_venda_arquivo_key"
  ON "stock_venda_arquivo"("companyId", "data", "relatorio");
CREATE INDEX "stock_venda_arquivo_data_idx"
  ON "stock_venda_arquivo"("companyId", "data");
