-- ⛔⛔⛔ O CUSTO MÉDIO NÃO MORRE QUANDO O ESTOQUE ZERA (13/10/2026) — lei do dono.
--
-- *"ele tem q fica com preco q tava antes de zero estoque e manter esse preco ate se estoque
-- fica negativo — uma coisa nao tem nada ve com outra"*.
--
-- O CASO: `metade de bolinha massa de pizza` tinha custo (~R$ 0,54), o serviço consumiu tudo,
-- o saldo foi a 0 — e a régua `saldo > 0 ? valor/saldo : null` APAGOU o custo. As 4 bases de
-- pizza viraram "a apurar" e o montador apagou. É a régua de todo sistema sério (SAP/TOTVS/
-- Odoo): custo médio é MEMÓRIA do item, não fração do momento.
--
-- ⛔⛔ POR QUE TABELA E NÃO COLUNA EM `stock_item` — regra dura do módulo, não preferência:
-- **migration de estoque SÓ CRIA** (`lib/stock/__tests__/migration-isolation.test.ts` reprova
-- qualquer `ALTER TABLE` numa migration `stock_`, no CI, antes do deploy). `ADD COLUMN` em
-- `stock_item` é ALTER. Mesmo caminho de `stock_receita_principal` (12/10),
-- `stock_ficha_retalho` (09/10) e `stock_dose_a_declarar` (08/10).
--
-- ⭐ E A AUSÊNCIA DA LINHA É "A DEFINIR", POR CONSTRUÇÃO: item que nunca teve entrada com
-- valor não tem linha aqui, e a porta devolve `null`. Não existe estado terceiro pra ler
-- errado — mais forte que um DEFAULT de coluna, porque nem o INSERT precisa lembrar dele.
--
-- ⚠️ `custoMedio > 0` é CHECK e não só convenção: custo zero/negativo não é "o que a coisa
-- custa", é resquício de estado impossível (o caso FANTA UVA, 11/09, em que o custo médio
-- virou −R$ 2.540,13 e contaminou a Posição, o cardápio e o CMV). Guardar isso como memória
-- propagaria a ficção pra frente, que é justamente o que esta tabela existe pra impedir.
--
-- ⚠️ REGRA 13 (lógica de três valores) — e o registro importa pra ninguém achar que esqueci:
-- `companyId`/`itemId`/`custoMedio` são NOT NULL, então `length(trim(x)) > 0` e `> 0` nunca
-- avaliam pra NULL (CHECK com expressão NULL **passa** — o furo do `chk_aviso_acao_completa`,
-- 04/10). A única coluna nullable é `movimentoId`, e o CHECK **não a compara**: ela é RASTRO
-- (qual entrada ensinou este número), e backfill não tem movimento único pra apontar.
--
-- ROLLBACK: DROP TABLE "stock_item_custo_vigente";

CREATE TABLE "stock_item_custo_vigente" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "custoMedio" DOUBLE PRECISION NOT NULL,
    "movimentoId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_item_custo_vigente_pkey" PRIMARY KEY ("id"),
    -- forma: id de empresa/item vazio ou só-espaço é dado torto entrando pela porta errada
    CONSTRAINT "chk_custo_vigente_forma" CHECK (
        length(trim("companyId")) > 0 AND length(trim("itemId")) > 0
    ),
    -- ⭐ memória só existe com custo defensável; ausência da linha = "a definir"
    CONSTRAINT "chk_custo_vigente_positivo" CHECK ("custoMedio" > 0)
);

-- ⭐ UMA memória por item: aprender 2× é UPDATE, nunca uma 2ª linha (o writer é idempotente
--   por construção, não "checado" — duas entradas no mesmo segundo não duplicam).
CREATE UNIQUE INDEX "stock_item_custo_vigente_companyId_itemId_key"
    ON "stock_item_custo_vigente"("companyId", "itemId");

-- a leitura da porta é sempre "a memória de TODOS os itens DESTA empresa" (1 consulta)
CREATE INDEX "stock_item_custo_vigente_companyId_idx"
    ON "stock_item_custo_vigente"("companyId");
