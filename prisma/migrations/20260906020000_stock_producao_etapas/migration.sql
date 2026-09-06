-- ⭐⭐ ETAPAS COM FUNCIONÁRIO E TEMPO POR TAREFA (06/09/2026).
--
-- O FATO DA COZINHA: a maioria das produções passa por DUAS MÃOS. No beef, um funcionário
-- faz o gessado na máquina e OUTRO molda as bolinhas. O modelo até aqui tinha UM
-- `colaboradorId` no cabeçalho da ordem — ou seja, sabia registrar só a segunda mão.
--
-- ⛔ TUDO AQUI SÓ CRIA. Migration de estoque é CREATE-only (guard de CI), e é o certo por
-- conteúdo também: `companyId` é VALOR indexado, sem @relation às tabelas fechadas.

-- ── 1. AS ETAPAS MORAM NA VERSÃO DA RECEITA ───────────────────────────────────────────
-- ⚠️ Na VERSÃO, não na ficha — pelo mesmo motivo dos componentes: mudar a lista de etapas é
-- mudar o MÉTODO, e ordem antiga tem que continuar apontando pro método da época. Sem isso,
-- renomear uma etapa hoje reescreveria o que aconteceu na cozinha em agosto.
CREATE TABLE "stock_ficha_etapa" (
  "id"        TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "versaoId"  TEXT NOT NULL,
  "posicao"   INTEGER NOT NULL,
  "nome"      TEXT NOT NULL,
  -- setor SUGERIDO (a ordem pode mandar outro); nunca obrigatório
  "setorId"   TEXT,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_ficha_etapa_nome" CHECK (length(trim("nome")) > 0),
  CONSTRAINT "chk_ficha_etapa_posicao" CHECK ("posicao" >= 0)
);
CREATE UNIQUE INDEX "stock_ficha_etapa_pos_uniq" ON "stock_ficha_etapa" ("versaoId", "posicao");
CREATE INDEX "stock_ficha_etapa_company_idx" ON "stock_ficha_etapa" ("companyId", "versaoId");

-- ── 2. A EXECUÇÃO: uma linha por etapa DA ORDEM ───────────────────────────────────────
-- ⭐ É aqui que mora o tempo, e ele é dos TOQUES do funcionário: `iniciadoEm` sai do botão
-- INICIAR, `finalizadoEm` do FINALIZAR. Ninguém digita duração.
--
-- ⛔⛔ NINGUÉM EDITA TEMPO. Não há caminho de UPDATE de horário no app: correção é evento
-- novo, com autor e motivo (`stock_ordem_etapa_correcao`), nunca sobrescrita — a mesma
-- disciplina do ledger, onde correção é estorno + novo.
--
-- ⚠️ UM RESPONSÁVEL POR ETAPA (decisão do dono, 06/09): quem inicia e finaliza ASSINA o
-- tempo. Dois trabalhando juntos dividiriam o tempo em rateio arbitrário e o min/kg viraria
-- número de fé. Se a dupla for sistemática, a etapa se divide — ou ganha desenho próprio.
CREATE TABLE "stock_ordem_etapa" (
  "id"             TEXT PRIMARY KEY,
  "companyId"      TEXT NOT NULL,
  "ordemId"        TEXT NOT NULL,
  "posicao"        INTEGER NOT NULL,
  "nome"           TEXT NOT NULL, -- SNAPSHOT do nome na época (a receita pode mudar depois)
  "setorId"        TEXT,
  -- quem a GERÊNCIA designou (pode ser null: quem pegar com o PIN fica registrado)
  "colaboradorId"  TEXT,
  "designadoPorId" TEXT,
  "designadoEm"    TIMESTAMP(3),
  -- quem EXECUTOU de fato (o PIN que iniciou). Pode diferir do designado — e o relatório
  -- conta pelo EXECUTOR, porque é a mão que trabalhou.
  "executorId"     TEXT,
  "iniciadoEm"     TIMESTAMP(3),
  "finalizadoEm"   TIMESTAMP(3),
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_ordem_etapa_posicao" CHECK ("posicao" >= 0),
  -- ⛔ terminar antes de começar é IMPOSSÍVEL no banco, não "checado"
  CONSTRAINT "chk_ordem_etapa_ordem_do_tempo" CHECK ("finalizadoEm" IS NULL OR ("iniciadoEm" IS NOT NULL AND "finalizadoEm" >= "iniciadoEm")),
  -- ⛔ e finalizar sem executor também: tempo sem dono não serve pro relatório
  CONSTRAINT "chk_ordem_etapa_executor" CHECK ("iniciadoEm" IS NULL OR "executorId" IS NOT NULL)
);
CREATE UNIQUE INDEX "stock_ordem_etapa_pos_uniq" ON "stock_ordem_etapa" ("ordemId", "posicao");
CREATE INDEX "stock_ordem_etapa_company_idx" ON "stock_ordem_etapa" ("companyId", "ordemId");
-- o índice que a JANELA DO FUNCIONÁRIO usa ("minhas tarefas de hoje")
CREATE INDEX "stock_ordem_etapa_colab_idx" ON "stock_ordem_etapa" ("companyId", "colaboradorId", "finalizadoEm");
CREATE INDEX "stock_ordem_etapa_abertas_idx" ON "stock_ordem_etapa" ("companyId", "iniciadoEm") WHERE "finalizadoEm" IS NULL;

-- ── 3. A CORREÇÃO DE TEMPO É EVENTO, NUNCA SOBRESCRITA ────────────────────────────────
CREATE TABLE "stock_ordem_etapa_correcao" (
  "id"           TEXT PRIMARY KEY,
  "companyId"    TEXT NOT NULL,
  "etapaId"      TEXT NOT NULL,
  "campo"        TEXT NOT NULL, -- INICIADO_EM | FINALIZADO_EM | EXECUTOR
  "de"           TEXT,
  "para"         TEXT,
  "motivo"       TEXT NOT NULL,
  "corrigidoPorId" TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_etapa_correcao_campo" CHECK ("campo" IN ('INICIADO_EM', 'FINALIZADO_EM', 'EXECUTOR')),
  -- ⚠️ correção sem motivo escrito é um número sem porquê — vira mistério em três meses
  CONSTRAINT "chk_etapa_correcao_motivo" CHECK (length(trim("motivo")) > 0)
);
CREATE INDEX "stock_ordem_etapa_correcao_idx" ON "stock_ordem_etapa_correcao" ("companyId", "etapaId");

-- ── 4. O PIN — IDENTIFICA, NÃO AUTENTICA (decisão do dono, 06/09) ─────────────────────
-- ⭐ Quatro dígitos num aparelho COMPARTILHADO da cozinha: o PIN diz QUEM está apertando
-- iniciar/finalizar; quem diz QUAL EMPRESA é a sessão do aparelho. É o padrão da categoria
-- (Jolt "Shared Device Mode", Operandio, Connecteam) e o mesmo do PDV.
--
-- ⛔ MESMO IDENTIFICANDO, VAI COMO HASH: o segredo vive num tablet de cozinha, lugar
-- exposto, e gente reusa 4 dígitos em outros lugares. É o mesmo tratamento do token da
-- Zebra. Guardar em claro seria vazar o PIN do banco de outra pessoa por preguiça.
CREATE TABLE "stock_colaborador_pin" (
  "id"            TEXT PRIMARY KEY,
  "companyId"     TEXT NOT NULL,
  "colaboradorId" TEXT NOT NULL,
  "pinHash"       TEXT NOT NULL,
  "criadoPorId"   TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revogadoEm"    TIMESTAMP(3),
  CONSTRAINT "chk_colaborador_pin_hash" CHECK (length("pinHash") > 20)
);
-- ⛔ UM PIN ativo por colaborador — trocar é revogar e criar, com rastro dos dois
CREATE UNIQUE INDEX "stock_colaborador_pin_ativo_uniq"
  ON "stock_colaborador_pin" ("companyId", "colaboradorId") WHERE "revogadoEm" IS NULL;
CREATE INDEX "stock_colaborador_pin_company_idx" ON "stock_colaborador_pin" ("companyId", "revogadoEm");
