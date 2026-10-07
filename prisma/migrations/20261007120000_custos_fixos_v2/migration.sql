-- ⭐⭐⭐ CUSTOS FIXOS v2 — PRATELEIRAS LIGÁVEIS (07/10/2026)
--
-- ⚠️⚠️ ALTERs em tabelas com DADOS REAIS
-- | tabela                 | operação                     | tipo            | linhas | risco | mitigação |
-- | custo_fixo_categoria   | ADD COLUMN prateleira        | aditiva c/ DEFAULT | 26  | baixo | DEFAULT 'CASA' preenche as 26 existentes; nenhuma sai de lugar |
-- | custo_fixo_categoria   | ADD COLUMN prateleiraDefinida* | aditiva nullable | 26  | baixo | NULL = "nunca movida, é o default" |
-- ROLLBACK:
--   ALTER TABLE "custo_fixo_categoria" DROP CONSTRAINT "chk_custo_fixo_prateleira_forma";
--   ALTER TABLE "custo_fixo_categoria" DROP CONSTRAINT "chk_custo_fixo_prateleira_rastro";
--   ALTER TABLE "custo_fixo_categoria" DROP COLUMN "prateleira", DROP COLUMN "prateleiraDefinidaPorId", DROP COLUMN "prateleiraDefinidaEm";
--   DROP TABLE "custo_fixo_chips";

-- ⭐ O DEFAULT É 'CASA' e isso é a direção SEGURA: as 26 categorias que o dono marcou em
-- 06/10 continuam aparecendo onde ele as pôs. Um default 'BANCO' teria movido 26 linhas de
-- lugar sem ninguém pedir.
ALTER TABLE "custo_fixo_categoria" ADD COLUMN "prateleira" TEXT NOT NULL DEFAULT 'CASA';
ALTER TABLE "custo_fixo_categoria" ADD COLUMN "prateleiraDefinidaPorId" TEXT;
ALTER TABLE "custo_fixo_categoria" ADD COLUMN "prateleiraDefinidaEm" TIMESTAMP(3);

-- ⛔⛔ CHECK DE **FORMA**, NUNCA DE VOCABULÁRIO. A lição de 21/09 (`chk_venda_map_alvo`) foi
-- caríssima: CHECK com lista fechada numa tabela de CONFIGURAÇÃO virou parede em UM DIA,
-- quando a palavra nova chegou — e migration de ALTER aplicada não se reescreve. Quem valida
-- o vocabulário (CASA|BANCO) é o TypeScript, onde se acrescenta uma linha.
ALTER TABLE "custo_fixo_categoria"
  ADD CONSTRAINT "chk_custo_fixo_prateleira_forma"
  CHECK ("prateleira" = upper("prateleira") AND length(trim("prateleira")) > 0);

-- ⛔⛔ REGRA 13 — LÓGICA DE TRÊS VALORES: o `IS NOT NULL` vem EXPLÍCITO e ANTES da comparação
-- de conteúdo. `length(trim(NULL))` não é 0, é NULL, e NULL contamina o AND inteiro → o CHECK
-- vira NULL → **PASSA**. Foi exatamente assim que o `chk_aviso_acao_completa` nasceu furado em
-- 04/10. Aqui: ou os DOIS campos do rastro existem, ou NENHUM.
ALTER TABLE "custo_fixo_categoria"
  ADD CONSTRAINT "chk_custo_fixo_prateleira_rastro"
  CHECK (
    ("prateleiraDefinidaPorId" IS NULL AND "prateleiraDefinidaEm" IS NULL)
    OR ("prateleiraDefinidaPorId" IS NOT NULL AND "prateleiraDefinidaEm" IS NOT NULL
        AND length(trim("prateleiraDefinidaPorId")) > 0)
  );

-- ⭐ O ESTADO DOS 3 INTERRUPTORES, POR USUÁRIO.
-- ⚠️ Tabela e não `localStorage`: localStorage é por NAVEGADOR, e o dono confere no celular e
-- no notebook — a escolha feita num sumiria no outro. "Persistido por usuário" só é verdade
-- se for no banco (a lição da mesa do Real×Teórico, 29/09).
-- ⚠️ AUSÊNCIA DE LINHA = TUDO LIGADO (a realidade de hoje). O default não é um valor gravado
-- no cadastro: quem nunca tocou nos chips vê a conta COMPLETA, senão a tela esconderia o
-- banco e os compromissos de quem não sabia que existia um interruptor.
CREATE TABLE "custo_fixo_chips" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "casa"          BOOLEAN NOT NULL DEFAULT true,
  "banco"         BOOLEAN NOT NULL DEFAULT true,
  "compromissos"  BOOLEAN NOT NULL DEFAULT true,
  "atualizadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custo_fixo_chips_pkey" PRIMARY KEY ("id")
);

-- ⛔ dois registros de chips pro mesmo par (empresa, usuário) é IMPOSSÍVEL no banco, não "checado"
CREATE UNIQUE INDEX "custo_fixo_chips_companyId_userId_key" ON "custo_fixo_chips"("companyId", "userId");

ALTER TABLE "custo_fixo_chips" ADD CONSTRAINT "custo_fixo_chips_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custo_fixo_chips" ADD CONSTRAINT "custo_fixo_chips_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
