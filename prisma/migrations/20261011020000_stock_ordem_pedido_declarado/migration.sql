-- ⭐⭐ O RASTRO DE CADA DECLARAÇÃO DE PEDIDO (11/10/2026) — CREATE-only, append-only.
--
-- **Decisão do dono:** a quantidade é perguntada UMA vez, DEPOIS de criar a ordem; e *"ATÉ
-- separar, o pedido pode ser corrigido pela MESMA tela (regrava a meta com rastro)"*.
--
-- ⛔⛔ POR QUE UMA TABELA E NÃO DUAS COLUNAS NA `stock_ordem_meta`:
--   (a) **ALTER é PROIBIDO** em migration de estoque desde a Fase 0 (guard de CI
--       `migration-isolation.test.ts`, e o artefato É este `.sql`);
--   (b) e seria errado por conteúdo: a meta guarda **o valor de HOJE** e tem
--       `criadoEm DEFAULT now()` (não `@updatedAt`), então um upsert de correção deixaria o
--       "quem · quando" apontando pra a PRIMEIRA declaração. É a cicatriz medida do
--       `stock_venda_import` (08/10), que mostrava o autor do 1º import pra sempre.
--
-- ⭐ Então: a **META é o valor corrente** (o que todo mundo lê) e **ESTA tabela é a história**
-- (quem declarou quanto, e quando) — o mesmo desenho de `stock_item_nome_anterior` ao lado do
-- nome do item e de `stock_unidade_corrigida` ao lado da entrada.
--
-- ⚠️ **SEM índice único de propósito:** duas linhas da mesma ordem é o caso NORMAL (declarou 30,
-- corrigiu pra 20). Unique aqui mataria justamente a correção que o dono pediu.
--
-- ROLLBACK: DROP TABLE "stock_ordem_pedido_declarado";
CREATE TABLE "stock_ordem_pedido_declarado" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "ordemId"        TEXT NOT NULL,
  "unidades"       DOUBLE PRECISION NOT NULL,
  -- ⭐ `false` na 1ª declaração, `true` nas CORREÇÕES — pra o rastro DIZER o que foi cada linha
  -- em vez de quem lê ter que deduzir pela ordem das datas (duas declarações no mesmo
  -- milissegundo deixariam a dedução arbitrária, a cicatriz do desempate por timestamp de 28/08)
  "correcao"       BOOLEAN NOT NULL DEFAULT false,
  "declaradoPorId" TEXT,
  "declaradoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_ordem_pedido_declarado_pkey" PRIMARY KEY ("id"),
  -- ⛔ pedido zero ou negativo não é um pedido (a mesma régua do `chk_meta_positiva`)
  CONSTRAINT "chk_pedido_declarado_positivo" CHECK ("unidades" > 0),
  -- ⛔⛔ CHECK de FORMA nas duas chaves. **As duas são NOT NULL de propósito**, e é isso que
  -- torna `length(trim(x)) > 0` seguro aqui: a REGRA 13 (04/10) nasceu de um CHECK sobre coluna
  -- NULLABLE, em que `length(trim(NULL))` é NULL e **CHECK com expressão NULL PASSA**. Onde a
  -- coluna pode ser nula, o `IS NOT NULL` vem explícito e ANTES; aqui ele é desnecessário por
  -- construção — e a prova contra Postgres (`scripts/prova-check-pedido-declarado.ts`) mede isso.
  CONSTRAINT "chk_pedido_declarado_company" CHECK (length(trim("companyId")) > 0),
  CONSTRAINT "chk_pedido_declarado_ordem" CHECK (length(trim("ordemId")) > 0)
);
CREATE INDEX "stock_ordem_pedido_declarado_ordem_idx" ON "stock_ordem_pedido_declarado"("companyId", "ordemId");
