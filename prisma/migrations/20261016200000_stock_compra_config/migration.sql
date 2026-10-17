-- ⭐⭐ A CONFIG DE COMPRA POR ITEM — a escrita nova da tela CONSUMO & COMPRAS (16/10/2026)
--
-- **Lei C5 da referência** (`docs/consumo-e-compras-referencia.html` v3): por item, o dono
-- declara os **dias de CHEGADA** (chips SEG…DOM, um ou vários), a **antecedência do pedido**
-- em dias (o prazo do fornecedor), o **fornecedor** (texto livre) e a **folga %** (padrão 10).
-- Sem isso a conta do pedido não existe: *"pedido que chega dia X cobre de X até a PRÓXIMA
-- chegada"* precisa saber quais são os dias.
--
-- ═══ ⛔⛔ POR QUE ESTA É A ÚNICA TABELA NOVA DO SPRINT ═══
--
-- O brief autorizou DUAS: esta e uma de membership pras listas 🥩 OS CAROS / 🍟 AS PORÇÕES.
-- **A de membership JÁ EXISTE** — `stock_radar_item` (20/09) guarda exatamente `CAROS` ·
-- `REVENDA` · `PORCOES`, com porta única (`listasDoRadar`/`porNaLista`/`tirarDaLista`), semente
-- e tela de gestão no Radar. Criar a segunda daria **duas verdades pra "quais itens o dono
-- acompanha"**: ele poria o FRANGO nos CAROS por esta tela e o Radar não saberia. ⚠️ É a
-- doença que esta casa mais paga (os 7 detectores de par, as 2 cópias do FITID, o badge que
-- dizia um número e a tela outro). **Reusar não foi economia: é a régua.**
--
-- ⛔ TABELA PRÓPRIA, nunca coluna em `stock_item`: migration de estoque **SÓ CRIA**
-- (`lib/stock/__tests__/migration-isolation.test.ts` reprova `ALTER TABLE` numa migration
-- `stock_`, no CI, antes do deploy). E é o certo por conteúdo também — config de COMPRA tem
-- autor e data, e o item não.
--
-- ⚠️ `companyId` é VALOR indexado, **sem `@relation`** (REGRA 8 do módulo): o isolamento
-- proíbe a migration de estoque referenciar tabela fechada.
--
-- ═══ ⚠️ REGRA 13 — LÓGICA DE TRÊS VALORES, E ONDE ELA MORDE AQUI ═══
--
-- `fornecedor` é a ÚNICA coluna nullable comparada por conteúdo, e o `IS NULL` vem
-- **explícito e PRIMEIRO**: `length(btrim(NULL, …))` é **NULL**, não 0, e NULL num CHECK
-- **PASSA** (o furo do `chk_aviso_acao_completa`, 04/10). Aqui NULL é legítimo (fornecedor é
-- opcional), então o ramo `IS NULL` é a resposta certa — o que ele não pode é ser implícito.
--
-- ⚠️ E o `btrim` leva a **classe de branco por extenso** (` \t\n\r\f\v`): o `btrim` do Postgres
-- apara **só o espaço** por default, então `E'\t'` passaria por um `trim()` simples — medido no
-- banco em 14/10, e a razão da migration `20261014201500`. **Caractere que não está na lista é
-- caractere que passa.**
--
-- ═══ ⭐ O CHECK É DE FORMA, NUNCA DE VOCABULÁRIO ═══
--
-- `diasChegada` é CSV de índices **SEG-first** (`"0,2,4"` = SEG/QUA/SEX), `''` = nenhum dia
-- configurado. O CHECK valida a FORMA (`^$|^[0-6](,[0-6])*$`) — ele não sabe o que é "um dia
-- útil" nem quantos dias uma semana tem pro dono. ⚠️ A lição de 21/09 é dura: `CHECK (lista IN
-- ('CAROS','PORCOES'))` virou **parede em UM dia** quando a 3ª lista nasceu, e num módulo
-- CREATE-only enum fechada no banco custa uma tabela nova a cada valor novo.
-- ⭐ E a forma já RECUSA só-espaço por construção (`'   '` não casa o regex) — por isso esta
-- tabela **não precisa** do trigger `stock_texto_de_escolha`.
--
-- ⛔ CSV e não array/JSON: `Int[]` do Postgres **não existe no SQLite do dev**, e código que só
-- compila num dos dois bancos é a divergência dev×prod que já custou a busca case-sensitive
-- (28/08). Quem serializa/parseia é a porta única (`lib/compras/config-de-compra.ts`).
--
-- ROLLBACK: DROP TABLE "stock_compra_config";

CREATE TABLE "stock_compra_config" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    -- CSV SEG-first dos dias em que a mercadoria CHEGA; '' = nenhum (item fica fora da mesa)
    "diasChegada" TEXT NOT NULL DEFAULT '',
    -- prazo do fornecedor: quantos dias ANTES da chegada o pedido tem que sair
    "antecedenciaDias" INTEGER NOT NULL DEFAULT 1,
    "fornecedor" TEXT,
    -- a folga em PONTOS PERCENTUAIS (10 = +10%); a lib converte pro fator 1,10
    "folgaPct" INTEGER NOT NULL DEFAULT 10,
    "definidoPorId" TEXT,
    "definidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_compra_config_pkey" PRIMARY KEY ("id"),

    -- forma: id de empresa/item vazio ou só-branco é dado torto entrando por outra porta
    CONSTRAINT "chk_compra_config_forma" CHECK (
        length(btrim("companyId", E' \t\n\r\f\v')) > 0
        AND length(btrim("itemId", E' \t\n\r\f\v')) > 0
    ),

    -- ⭐ FORMA do CSV, não vocabulário: índices 0..6, sem repetir sintaxe, '' permitido
    CONSTRAINT "chk_compra_config_dias" CHECK ("diasChegada" ~ '^$|^[0-6](,[0-6])*$'),

    -- ⚠️ 0 é legítimo (fornecedor que entrega no mesmo dia do pedido); o teto existe pra
    --    dedo escorregado não virar "pedir com 300 dias de antecedência" na agenda
    CONSTRAINT "chk_compra_config_antecedencia" CHECK (
        "antecedenciaDias" >= 0 AND "antecedenciaDias" <= 30
    ),

    -- ⚠️ folga 0 é legítima (o dono pode não querer folga); 200% é o teto de sanidade
    CONSTRAINT "chk_compra_config_folga" CHECK ("folgaPct" >= 0 AND "folgaPct" <= 200),

    -- ⚠️ REGRA 13: o `IS NULL` vem PRIMEIRO e explícito — sem ele o CHECK avalia pra NULL e
    --    um fornecedor '   ' PASSARIA, virando um nome em branco no texto do WhatsApp
    CONSTRAINT "chk_compra_config_fornecedor" CHECK (
        "fornecedor" IS NULL OR length(btrim("fornecedor", E' \t\n\r\f\v')) > 0
    )
);

-- ⭐ UMA config por item: salvar 2× é UPDATE, nunca uma 2ª linha (idempotente por construção,
--   não "checado" — dois toques no celular não criam duas configs que divergem)
CREATE UNIQUE INDEX "stock_compra_config_companyId_itemId_key"
    ON "stock_compra_config"("companyId", "itemId");

-- a leitura da tela é sempre "a config de TODOS os itens desta empresa", em 1 consulta
CREATE INDEX "stock_compra_config_companyId_idx"
    ON "stock_compra_config"("companyId");
