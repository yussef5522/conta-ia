-- ⭐⭐⭐ IGNORAR NÃO É UM DESTINO (23/09/2026).
--
-- ⛔⛔ **O DEFEITO, medido em prod:** a feature "ignorar produto" nasceu em 14/09 e
-- **NUNCA funcionou** — toda tentativa devolvia HTTP 500 com corpo vazio, porque o CHECK
-- de 22/08 (`chk_venda_map_alvo`) só admite `IN ('FICHA','REVENDA')`. Nove dias de uma
-- feature morta em produção, e os `0 IGNORAR` no mapa de produtos não eram "ninguém usou":
-- eram "é impossível".
--
-- ⚠️⚠️ **É A MESMA LIÇÃO QUE EU ESCREVI ANTEONTEM**, no radar: *"CHECK com vocabulário
-- fechado numa tabela de CONFIGURAÇÃO envelhece mal"*. Lá o prazo foi de um dia; aqui o
-- CHECK é de agosto e a palavra nova chegou em setembro.
--
-- ⭐ **E A CURA NÃO É UMA TABELA-CLONE DO MAPA.** Renomear o model custaria 61 usos em 34
-- arquivos — um deles a BAIXA DE VENDA, que mexe em estoque. Mais importante: `alvoTipo`
-- responde *"para onde baixa"*, e **ignorar não responde isso**. Ignorar é
-- ***"não tem destino, E isso é decisão tomada"*** — que é exatamente o que separa o
-- IGNORADO do SEM_DESTINO (o mesmo nome, sem ninguém ter dito nada).
--
-- ⭐ Efeito colateral bom: sem linha no mapa, a baixa **já não baixa** o nome ignorado —
-- por construção, sem nenhum leitor novo precisar aprender a palavra.
CREATE TABLE "stock_venda_ignorado" (
    "id"           TEXT NOT NULL,
    "companyId"    TEXT NOT NULL,
    "nomeSuitable" TEXT NOT NULL,
    "criadoPorId"  TEXT,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_venda_ignorado_pkey" PRIMARY KEY ("id"),
    -- ⭐ o CHECK valida FORMA (nome não-vazio), nunca vocabulário — a lição acima
    CONSTRAINT "chk_venda_ignorado_nome" CHECK ("nomeSuitable" <> '')
);

-- ⛔ ignorar o MESMO nome duas vezes é impossível, não "checado" (REGRA 5)
CREATE UNIQUE INDEX "stock_venda_ignorado_company_nome_key"
    ON "stock_venda_ignorado"("companyId", "nomeSuitable");
CREATE INDEX "stock_venda_ignorado_companyId_idx" ON "stock_venda_ignorado"("companyId");

-- ⚠️ NADA a migrar: o CHECK impediu que qualquer linha IGNORAR existisse no mapa de
-- produtos. Conferido em prod antes de escrever isto — 0 linhas.
