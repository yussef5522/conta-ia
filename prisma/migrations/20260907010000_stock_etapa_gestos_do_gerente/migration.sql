-- ⭐⭐ OS DOIS GESTOS DO GERENTE PRA ETAPA ABERTA (07/09/2026).
--
-- **A ordem do dono:** *"gerente NUNCA fica preso olhando uma etapa aberta sem poder agir."*
-- Antes disto havia UM caminho (a pessoa finaliza no tablet) e nenhuma saída quando ela não
-- estava mais lá — a etapa ficava aberta pra sempre, o cronômetro correndo.
--
-- São DOIS gestos, e a diferença entre eles é a qualidade do DADO:
--   1. PEDIR PRA FINALIZAR → o caminho PREFERIDO. A pessoa aperta com o PIN dela, o tempo é
--      DELA e é MEDIDO de verdade — entra na média.
--   2. FINALIZAR PELO GERENTE → a saída de quando ela foi embora. ⛔ Tempo = A APURAR: o
--      gerente não sabe quando ela parou, e tempo não se inventa.
--
-- ⛔⛔ E O `finalizadoEm` DA ETAPA CONTINUA NULL no caso 2 — de propósito, REGRA 5. Se o
-- gesto carimbasse a coluna, o tempo entraria em TODA média por construção (o relatório
-- calcula `fim − início`), e nenhuma lista de exceções seguraria isso pra sempre. O fato
-- mora em linha própria, e a coluna nula é o que torna o erro IMPOSSÍVEL, não improvável.
--
-- ⛔ TUDO AQUI SÓ CRIA. Migration de estoque é CREATE-only (guard de CI).

-- ── 1. "PEDI PRA VOCÊ FINALIZAR" — o recado que aparece no tablet ─────────────────────
CREATE TABLE "stock_etapa_pedido_finalizar" (
  "id"          TEXT PRIMARY KEY,
  "companyId"   TEXT NOT NULL,
  "etapaId"     TEXT NOT NULL,
  "ordemId"     TEXT NOT NULL,
  "pedidoPorId" TEXT,
  "pedidoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ⚠️ carimbado quando a pessoa REALMENTE finaliza. Guardar o desfecho (em vez de apagar a
  -- linha) é o que permite saber depois se o pedido funcionou — pedido que ninguém atende é
  -- informação de gestão, não lixo a limpar.
  "atendidoEm"  TIMESTAMP(3)
);
-- ⭐ UM pedido por etapa: pedir de novo é REENVIAR (atualiza a data), nunca empilhar recados
-- que fariam o tablet mostrar o mesmo aviso três vezes.
CREATE UNIQUE INDEX "stock_etapa_pedido_etapa_uniq" ON "stock_etapa_pedido_finalizar" ("etapaId");
CREATE INDEX "stock_etapa_pedido_company_idx" ON "stock_etapa_pedido_finalizar" ("companyId", "ordemId");

-- ── 2. "FINALIZEI POR ELA" — o gesto que fecha sem inventar tempo ─────────────────────
CREATE TABLE "stock_etapa_finalizada_gerente" (
  "id"              TEXT PRIMARY KEY,
  "companyId"       TEXT NOT NULL,
  "etapaId"         TEXT NOT NULL,
  "ordemId"         TEXT NOT NULL,
  -- ⭐⭐ QUEM APERTOU (o usuário logado) e EM NOME DE QUEM (o colaborador que executava).
  -- Os dois campos existem porque o rastro tem que dizer a VERDADE: "finalizada por Yussef em
  -- nome de Carlise". Guardar só o colaborador seria "entrar na conta dela" — exatamente o
  -- que o dono proibiu.
  "finalizadaPorId" TEXT,
  "emNomeDeId"      TEXT,
  "finalizadaEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- opcional: o gerente pode escrever o que houve ("foi embora e esqueceu")
  "observacao"      TEXT
);
-- ⭐ finalizar 2× a mesma etapa é impossível, não "checado"
CREATE UNIQUE INDEX "stock_etapa_final_gerente_etapa_uniq" ON "stock_etapa_finalizada_gerente" ("etapaId");
CREATE INDEX "stock_etapa_final_gerente_company_idx" ON "stock_etapa_finalizada_gerente" ("companyId", "ordemId");
