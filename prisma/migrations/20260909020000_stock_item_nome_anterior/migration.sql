-- ⭐⭐ O NOME ANTIGO VIRA APELIDO DE BUSCA (09/09/2026).
--
-- **O dono:** *"Nome antigo vira APELIDO de busca (buscar 'CC 600' acha a COCA COLA 600ML) —
-- a Marcyelle não se perde na contagem, e o rastro guarda 'renomeado de X por Yussef'."*
--
-- ⛔ CREATE-only, como toda migration deste módulo (o guard de isolamento recusa ALTER/DROP).
-- ⚠️ O UNIQUE é (companyId, itemId, nomeAnterior): renomear e voltar atrás não duplica a
-- linha, e o mesmo apelido não nasce duas vezes no mesmo item.
CREATE TABLE "stock_item_nome_anterior" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "itemId"        TEXT NOT NULL,
  "nomeAnterior"  TEXT NOT NULL,
  "renomeadoPorId" TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_nome_anterior_pkey" PRIMARY KEY ("id"),
  -- ⛔ apelido vazio não é apelido: impossível por construção, não "checado no app"
  CONSTRAINT "chk_nome_anterior_nao_vazio" CHECK (length(trim("nomeAnterior")) > 0)
);

CREATE UNIQUE INDEX "stock_item_nome_anterior_unico"
  ON "stock_item_nome_anterior"("companyId", "itemId", "nomeAnterior");
CREATE INDEX "stock_item_nome_anterior_item"
  ON "stock_item_nome_anterior"("companyId", "itemId");
