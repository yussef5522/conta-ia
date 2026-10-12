-- ⭐⭐ AS RECEITAS PRINCIPAIS — a estrela do dono (12/10/2026)
--
-- **Ordem do dono:** *"mais importante ou mais caro e eu tem opcao de coloca receitas
-- dentro… e tira tbm quando achou q nao mais importante"* — 44 receitas, e ele quer fixar
-- as que importam EM CIMA, na mão dele. Categoria automática (carnes/queijos/legumes) foi
-- DESCARTADA no chat: quem decide o que importa é ele, não um mapa de palavra.
--
-- ⛔⛔ POR QUE TABELA E NÃO COLUNA EM `stock_ficha` — e isto é a regra dura do módulo, não
-- preferência minha: **migration de estoque SÓ CRIA** (`lib/stock/__tests__/migration-isolation.test.ts`
-- reprova qualquer `ALTER TABLE` numa migration `stock_`, no CI, antes do deploy).
-- `ADD COLUMN` em `stock_ficha` é ALTER. A intenção do pedido fica INTACTA: a marca é da
-- IDENTIDADE da receita (`fichaId`), **nunca da versão** — marcar/desmarcar não cria versão,
-- não mexe em custo e não passa perto de `explodirReceita`. É o mesmo desenho de
-- `stock_ficha_retalho` (09/10), `stock_dose_a_declarar` (08/10) e `stock_item_validade`.
--
-- ⭐ E O "NASCE false, NUNCA NULL" SAI DE GRAÇA, POR CONSTRUÇÃO: linha ausente = não é
-- principal. Não existe estado terceiro pra ler errado — mais forte que um DEFAULT de
-- coluna, porque nem o INSERT precisa lembrar do default.
--
-- ⚠️ A COLUNA `principal` EXISTE (em vez de "desmarcar = apagar a linha") pra o rastro
-- sobreviver ao desmarcar: *quem* tirou e *quando*. O gesto vai e volta muito (o dono pediu
-- exatamente isso), então append-only viraria ruído; o upsert vira o booleano e reescreve o
-- rastro. Ausência e `false` significam a MESMA coisa na leitura — é a régua de "ausência =
-- padrão" do `stock_etapa_plano`.
--
-- ⚠️ REGRA 13 (lógica de três valores) NÃO MORDE AQUI, e o registro importa pra ninguém achar
-- que eu esqueci: `companyId`/`fichaId` são **NOT NULL**, então `length(trim(x)) > 0` nunca
-- avalia pra NULL. A única coluna nullable é `marcadoPorId`, e o CHECK **não a compara** (dono
-- do sistema não tem usuário — carimbar um id inventado seria pior que a ausência).
--
-- ROLLBACK: DROP TABLE "stock_receita_principal";

CREATE TABLE "stock_receita_principal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "marcadoPorId" TEXT,
    "marcadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_receita_principal_pkey" PRIMARY KEY ("id"),
    -- forma: id de empresa/ficha vazio ou só-espaço é dado torto entrando pela porta errada
    CONSTRAINT "chk_receita_principal_forma" CHECK (
        length(trim("companyId")) > 0 AND length(trim("fichaId")) > 0
    )
);

-- ⭐ UMA marca por receita: marcar 2× é UPDATE, nunca uma 2ª linha (o gesto é idempotente
--   por construção, não "checado" — dois toques rápidos no celular não duplicam).
CREATE UNIQUE INDEX "stock_receita_principal_companyId_fichaId_key"
    ON "stock_receita_principal"("companyId", "fichaId");

-- a leitura da tela é sempre "quais são as principais DESTA empresa"
CREATE INDEX "stock_receita_principal_companyId_principal_idx"
    ON "stock_receita_principal"("companyId", "principal");
