-- ⭐⭐⭐ EQUIPAMENTO (IMOBILIZADO) — máquina não é estoque (20/10/2026)
--
-- **O caso:** a NF da BOLEADORA BOL600 (1 UN, R$ 21.000) parada no funil. O funil só oferecia
-- categorias de ESTOQUE, e `sugerirCategoria` cai em `USO_INTERNO` quando nada casa — então o
-- balde onde equipamento cai hoje é **por construção**. Classificado ali, ele nasce com
-- POSIÇÃO, entra no custo médio e polui toda tela de estoque.
--
-- ═══ ⛔⛔ DUAS TABELAS, E CADA UMA RESPONDE UMA PERGUNTA ═══
--
--   `stock_equipamento`           → O CADASTRO: "o que eu comprei de imobilizado?"
--   `stock_supplier_equipamento`  → O APRENDIZADO: "este produto deste fornecedor é máquina?"
--
-- ⛔ TABELA, nunca coluna em `stock_item`: migration de estoque **SÓ CRIA**
-- (`lib/stock/__tests__/migration-isolation.test.ts` reprova `ALTER TABLE` numa migration
-- `stock_`, no CI, antes do deploy). E é o certo por conteúdo — equipamento **não é um
-- `stock_item`**: ele não tem saldo, não tem custo médio, não se conta na câmara.
--
-- ⚠️ `companyId` é VALOR indexado, **sem `@relation`** (a regra do módulo): o isolamento
-- proíbe a migration de estoque referenciar tabela fechada.
--
-- ═══ ⭐⭐ POR QUE O MAPA DE APRENDIZADO NÃO PODE SER O QUE JÁ EXISTE ═══
--
-- `stock_supplier_product` e `stock_supplier_produto_nome` têm **`itemId` REQUIRED** — eles
-- respondem *"qual ITEM DE ESTOQUE é este produto"*, e equipamento **não tem item**. Gravar
-- um itemId fantasma ali pra reusar a tabela criaria exatamente a posição que este sprint
-- existe pra impedir.
--
-- ⛔⛔ E AS DUAS FAMÍLIAS SÃO **MUTUAMENTE EXCLUSIVAS NA ESCRITA** (a porta única apaga o mapa
-- de item ao gravar equipamento, e vice-versa): conflito entre *"é o item X"* e *"é máquina"*
-- fica **impossível**, em vez de resolvido depois por regra de precedência que alguém esquece.
--
-- ═══ ⚠️ REGRA 13 — ONDE ELA MORDE AQUI ═══
--
-- `supplierCnpj` (no cadastro) e `cProd` (no mapa) são as colunas **nullable comparadas por
-- conteúdo**, e o `IS NULL` vem **explícito e PRIMEIRO**: `length(btrim(NULL, …))` é **NULL**,
-- não 0, e NULL num CHECK **PASSA** (o furo do `chk_aviso_acao_completa`, 04/10). Aqui NULL é
-- legítimo (DANFE de papel pode não trazer CNPJ nem código) — o que ele não pode é ser
-- implícito.
--
-- ⚠️ E o `btrim` leva a **classe de branco por extenso** (` \t\n\r\f\v`): o `btrim` do
-- Postgres apara **só o espaço** por default, então `E'\t'` passaria por um `trim()` simples —
-- medido no banco em 14/10, e a razão da migration `20261014201500`. **Caractere que não está
-- na lista é caractere que passa.**
--
-- ROLLBACK: DROP TABLE "stock_supplier_equipamento"; DROP TABLE "stock_equipamento";

-- ---------------------------------------------------------------------------
-- O CADASTRO — o que o brief pede: nome, NF/fornecedor, data, valor
-- ---------------------------------------------------------------------------
CREATE TABLE "stock_equipamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    -- ⚠️ o valor da LINHA da nota (vProd da linha × o que foi recebido), não o total da nota:
    --    nota mista tem equipamento E mercadoria, e o investido é só a parte da máquina
    "valor" DOUBLE PRECISION NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    -- a data do FATO (emissão da nota), nunca o relógio do conserto
    "data" TIMESTAMP(3) NOT NULL,

    "supplierCnpj" TEXT,
    "supplierNome" TEXT NOT NULL,

    -- de ONDE veio: a nota, a linha da nota e a conferência que registrou o recebimento
    "chave" TEXT,
    "nfeId" TEXT,
    -- ⭐ a IDEMPOTÊNCIA (ver o índice único abaixo). NULLABLE de propósito: deixa a porta
    --   aberta pro equipamento comprado SEM nota (entrada manual) sem precisar de ALTER —
    --   que este módulo proíbe.
    "nfeItemId" TEXT,
    "conferenceId" TEXT,

    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_equipamento_pkey" PRIMARY KEY ("id"),

    -- forma: id de empresa vazio/só-branco é dado torto entrando por outra porta, e
    -- equipamento sem NOME é linha que o dono não consegue reconhecer na lista
    CONSTRAINT "chk_equipamento_forma" CHECK (
        length(btrim("companyId", E' \t\n\r\f\v')) > 0
        AND length(btrim("nome", E' \t\n\r\f\v')) > 0
        AND length(btrim("supplierNome", E' \t\n\r\f\v')) > 0
    ),

    -- ⚠️ `>= 0` e não `> 0`: equipamento em bonificação/doação existe e vale zero. Travar
    --    aqui recusaria a conferência INTEIRA da nota por causa de um brinde — e o total
    --    investido continua honesto (somar zero não mente).
    CONSTRAINT "chk_equipamento_valor" CHECK ("valor" >= 0),

    CONSTRAINT "chk_equipamento_qtd" CHECK ("quantidade" > 0),

    -- ⚠️ REGRA 13: o `IS NULL` vem PRIMEIRO e explícito — sem ele o CHECK avalia pra NULL e
    --    um CNPJ '   ' PASSARIA, virando fornecedor em branco na lista do dono
    CONSTRAINT "chk_equipamento_cnpj" CHECK (
        "supplierCnpj" IS NULL OR length(btrim("supplierCnpj", E' \t\n\r\f\v')) > 0
    )
);

-- ⭐⭐ IDEMPOTÊNCIA POR CONSTRUÇÃO: a MESMA linha da nota virar dois equipamentos é
--   IMPOSSÍVEL, não "checado". Confirmar a conferência 2× não dobra o investido.
--
-- ⚠️ E ele conviver com `nfeItemId` NULL é de graça: no Postgres NULL nunca é igual a NULL,
--   então N equipamentos sem nota continuam permitidos pelo MESMO índice.
CREATE UNIQUE INDEX "stock_equipamento_companyId_nfeItemId_key"
    ON "stock_equipamento"("companyId", "nfeItemId");

-- a lista da tela é "todo equipamento desta empresa, mais novo primeiro", em 1 consulta
CREATE INDEX "stock_equipamento_companyId_data_idx"
    ON "stock_equipamento"("companyId", "data");

-- ⭐ a régua ÚNICA que o E2 e o E16 consomem (ver `lib/stock/equipamento.ts`): "quais linhas
--   desta conferência / desta nota são equipamento?" — os dois agrupam a MESMA leitura
CREATE INDEX "stock_equipamento_companyId_conferenceId_idx"
    ON "stock_equipamento"("companyId", "conferenceId");
CREATE INDEX "stock_equipamento_companyId_chave_idx"
    ON "stock_equipamento"("companyId", "chave");

-- ---------------------------------------------------------------------------
-- O APRENDIZADO — "BOLEADORA → equipamento, uma vez só" (item 2 do brief)
-- ---------------------------------------------------------------------------
CREATE TABLE "stock_supplier_equipamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierCnpj" TEXT NOT NULL,
    -- ⚠️ o código do fornecedor é o casamento PRECISO, mas DANFE digitado não tem — por isso
    --    ele é nullable e a CHAVE é o nome normalizado, que sempre existe
    "cProd" TEXT,
    "xProd" TEXT NOT NULL,
    "xProdNormalizado" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_supplier_equipamento_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "chk_supplier_equip_forma" CHECK (
        length(btrim("companyId", E' \t\n\r\f\v')) > 0
        AND length(btrim("supplierCnpj", E' \t\n\r\f\v')) > 0
        AND length(btrim("xProdNormalizado", E' \t\n\r\f\v')) > 0
    ),

    -- ⚠️ REGRA 13 de novo: `cProd` nullable comparado por conteúdo
    CONSTRAINT "chk_supplier_equip_cprod" CHECK (
        "cProd" IS NULL OR length(btrim("cProd", E' \t\n\r\f\v')) > 0
    )
);

-- ⭐ UMA linha por (fornecedor, produto): aprender 2× é UPDATE, nunca uma 2ª linha que
--   divergiria da primeira
CREATE UNIQUE INDEX "stock_supplier_equipamento_cnpj_nome_key"
    ON "stock_supplier_equipamento"("companyId", "supplierCnpj", "xProdNormalizado");

-- lookup pelo código do fornecedor, quando a nota traz (o casamento preferencial)
CREATE INDEX "stock_supplier_equipamento_cnpj_cprod_idx"
    ON "stock_supplier_equipamento"("companyId", "supplierCnpj", "cProd");
