-- ⭐⭐ O MAPA APRENDIDO POR **NOME** (31/08/2026) — irmão do mapa por código.
--
-- ⛔ O QUE ELE DESTRAVA: `stock_supplier_product` é chaveado por
-- `@@unique(companyId, supplierCnpj, cProd)` — o CÓDIGO do produto no fornecedor, que só
-- existe no XML. Item digitado do DANFE de papel grava `cProd: null` e **não cabe nessa
-- chave**; por isso o vínculo que o dono cria digitando morria com a nota, e ele tinha que
-- mapear tudo de novo ("0/0 mapeados"). Dois trabalhos onde deveria ser um.
--
-- ⚠️ TABELA NOVA E NÃO ALTER: o isolamento do módulo proíbe ALTER (guard de CI). E ficou
-- melhor assim — são duas chaves de natureza diferente, não uma coluna a mais.
--
-- ⚠️⚠️ CASAR POR NOME É MAIS FROUXO QUE POR CÓDIGO, e o desenho assume isso:
--   · a chave é o nome NORMALIZADO INTEIRO (sem acento, sem caixa, espaços colapsados) —
--     **nunca "parecido"**. Nome parecido virando vínculo automático seria o sistema
--     adivinhando mercadoria, que é a linha vermelha deste módulo.
--   · e o vínculo guarda de ONDE veio (`origem`), pra o dono poder auditar depois:
--     "esse item foi casado pelo código do fornecedor ou por um nome que eu digitei?"
--     Heurística SUGERE — e o que ela sugeriu tem que ser rastreável.

CREATE TABLE "stock_supplier_produto_nome" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierCnpj" TEXT NOT NULL,
    -- o nome como veio do papel, PRESERVADO (é o que o dono leu no DANFE)
    "xProd" TEXT NOT NULL,
    -- a chave de casamento: o mesmo nome, normalizado. Igualdade INTEIRA, nunca prefixo.
    "xProdNormalizado" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fatorConversao" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidadeNota" TEXT,
    -- ⭐ CODIGO | NOME — de onde veio o vínculo. Auditável na ficha e no recibo.
    "origem" TEXT NOT NULL DEFAULT 'NOME',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_supplier_produto_nome_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_sspn_origem" CHECK ("origem" IN ('CODIGO','NOME')),
    -- ⛔ fator 0 ou negativo multiplicaria a entrada por nada / por menos nada
    CONSTRAINT "chk_sspn_fator" CHECK ("fatorConversao" > 0),
    CONSTRAINT "chk_sspn_nome" CHECK (length(trim("xProdNormalizado")) > 0)
);

-- um nome, um destino, por fornecedor: o mesmo produto não pode apontar pra dois itens
CREATE UNIQUE INDEX "stock_supplier_produto_nome_unica"
    ON "stock_supplier_produto_nome"("companyId", "supplierCnpj", "xProdNormalizado");
CREATE INDEX "stock_supplier_produto_nome_item_idx"
    ON "stock_supplier_produto_nome"("companyId", "itemId");
