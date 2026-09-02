-- ⭐⭐ COMPLEMENTOS DO PDV (02/09/2026) — onde vivem os sabores de pizza.
--
-- Sem este relatório o estoque NÃO baixa sabor nenhum: o de PRODUTOS diz que saíram N
-- pizzas grandes, mas não diz de QUE sabor. `CALABRESA` = 1.220 ocorrências no período.
--
-- ⭐ REGRA DE NEGÓCIO (decisão do dono): **1 ocorrência = 1 explosão da ficha, SEMPRE**,
-- independente do tamanho. Quem garante é o CARDÁPIO: pizza pequena obriga 2 sabores,
-- grande 4 — uma grande inteira de calabresa vem como 4 ocorrências. Nada de fração.
--
-- ⚠️ DUAS TABELAS NOVAS EM VEZ DE COLUNAS NAS EXISTENTES, e não é preferência:
--   (a) migration de estoque é CREATE-only (guard de CI: 0 ALTER/DROP);
--   (b) **ocorrência ≠ unidade vendida** — misturar na `stock_venda_linha` faria toda query
--       existente ter que lembrar de filtrar por tipo, e a que esquecesse somaria sabor
--       com produto;
--   (c) o MAPA precisa de destino POR ORIGEM: 25 nomes aparecem nos DOIS relatórios
--       (COCA COLA 2L: 337 como produto, 134 como complemento; MAIONESE CASEIRA COM ALHO:
--       31 e 78). Com um mapa só, cada um desses baixaria DUAS VEZES.
CREATE TABLE "stock_venda_complemento_linha" (
    "id"           TEXT NOT NULL,
    "companyId"    TEXT NOT NULL,
    "importId"     TEXT NOT NULL,
    "data"         TIMESTAMP(3) NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    -- ⚠️ OCORRÊNCIAS, não unidades: 4 numa pizza grande inteira de um sabor só
    "ocorrencias"  INTEGER NOT NULL,
    "valorTotal"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mapeadoNoImport" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_venda_complemento_linha_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_complemento_ocorrencias" CHECK ("ocorrencias" > 0)
);
CREATE INDEX "stock_venda_complemento_linha_company_import_idx" ON "stock_venda_complemento_linha"("companyId", "importId");
CREATE INDEX "stock_venda_complemento_linha_company_data_idx" ON "stock_venda_complemento_linha"("companyId", "data");

-- O MAPA dos complementos — espelha o de produtos, chave própria por origem.
-- ⚠️ `alvoTipo` aceita FICHA | IGNORAR (não há REVENDA aqui: complemento não é item de
-- prateleira). IGNORAR é REVERSÍVEL — é o destino de tamanhos e de milkshake/açaí/doces,
-- que entram depois por decisão do dono.
CREATE TABLE "stock_venda_complemento_map" (
    "id"           TEXT NOT NULL,
    "companyId"    TEXT NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "alvoTipo"     TEXT NOT NULL,
    "fichaId"      TEXT,
    "criadoPorId"  TEXT,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_venda_complemento_map_pkey" PRIMARY KEY ("id"),
    -- IGNORAR não aponta pra ficha; FICHA obrigatoriamente aponta
    CONSTRAINT "chk_complemento_map_alvo" CHECK (
        ("alvoTipo" = 'IGNORAR' AND "fichaId" IS NULL) OR
        ("alvoTipo" = 'FICHA'   AND "fichaId" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "stock_venda_complemento_map_company_nome_key" ON "stock_venda_complemento_map"("companyId", "nomeSuitable");
