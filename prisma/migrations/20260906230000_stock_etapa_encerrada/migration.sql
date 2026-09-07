-- ⛔⛔ A ETAPA QUE A ORDEM LEVOU JUNTO (06/09/2026) — a fresta entre os DOIS caminhos.
--
-- **CASO REAL:** a etapa foi iniciada com o PIN da Carlise às 16:38 e a ordem foi concluída
-- pela TELA DE PRODUÇÃO (o caminho do encarregado, que ajusta o consumo e NÃO finaliza no
-- tablet). A etapa ficou **aberta há 7h05 sem nenhum gesto que a resolvesse**: o tablet
-- recusa (ordem encerrada) e a Produção não tinha botão. E o "HOJE ao vivo" a contava no
-- AGORA — *"Carlise · fazendo há 7h05"* — o retrato do presente mentindo por causa de uma
-- ordem que já acabou.
--
-- ⛔ **NÃO É "FINALIZAR POR ELA".** Inventar um `finalizadoEm` criaria um tempo que ninguém
-- mediu, e esse tempo entraria na média de min/un como se fosse fato. O que se registra é
-- outra coisa: **a ordem encerrou e levou a etapa junto**. Tempo = a apurar, fora das médias.
--
-- ⛔ TUDO AQUI SÓ CRIA. Migration de estoque é CREATE-only (guard de CI), e é o certo por
-- conteúdo também: encerramento tem AUTOR e DATA, então é linha própria, nunca uma coluna
-- de estado sobrescrita — a mesma disciplina da correção de unidade e do estorno do ledger.
CREATE TABLE "stock_etapa_encerrada" (
  "id"             TEXT PRIMARY KEY,
  "companyId"      TEXT NOT NULL,
  "etapaId"        TEXT NOT NULL,
  "ordemId"        TEXT NOT NULL,
  -- por que a etapa foi levada: a ordem foi CONCLUÍDA ou CANCELADA
  "motivo"         TEXT NOT NULL,
  "encerradaEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- ⚠️ quem encerrou a ORDEM (o encarregado), não quem executava a etapa — o rastro diz
  -- quem fez, não quem é culpado.
  "encerradaPorId" TEXT,
  CONSTRAINT "chk_etapa_encerrada_motivo" CHECK ("motivo" IN ('ORDEM_CONCLUIDA', 'ORDEM_CANCELADA'))
);

-- ⭐ CAMADA 1: encerrar a MESMA etapa duas vezes é IMPOSSÍVEL, não "checado". Sem isso, uma
-- conclusão parcial seguida da final gravaria dois encerramentos pra a mesma etapa e a tela
-- teria duas verdades sobre o mesmo fato.
CREATE UNIQUE INDEX "stock_etapa_encerrada_etapa_uniq" ON "stock_etapa_encerrada" ("etapaId");
CREATE INDEX "stock_etapa_encerrada_company_idx" ON "stock_etapa_encerrada" ("companyId", "ordemId");
