-- ⭐⭐ MODELOS DE ETIQUETA EDITÁVEIS (30/08/2026) — o dono DESENHA a etiqueta dele.
--
-- A SuFlex deixa CONFIGURAR (ligar/desligar). Aqui o dono DESENHA: renomeia rótulo,
-- reordena bloco, muda fonte, adiciona linha de texto livre ("Mantenha congelado", CNPJ)
-- e cria quantos modelos quiser — "Produção" (com lote+QR), "Manipulação" (simples), o que
-- ele inventar. Por item dá pra escolher qual modelo usar.
--
-- ⚠️ OS BLOCOS VÃO EM JSON de propósito: é uma LISTA ORDENADA de coisas heterogêneas
-- (campo do sistema, texto livre, QR) que só o render entende. Modelar em tabela relacional
-- daria uma linha por bloco e um `ordem` inteiro pra manter na mão — mais junta pra ler e
-- mais jeito de ficar inconsistente, sem ganho: ninguém consulta bloco isolado.
CREATE TABLE "stock_etiqueta_modelo" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "nome"      TEXT NOT NULL,
  "blocos"    TEXT NOT NULL,              -- JSON: Bloco[]
  "padrao"    BOOLEAN NOT NULL DEFAULT false,
  "criadoPorId" TEXT,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_etiqueta_modelo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_modelo_nome" CHECK (length(trim("nome")) > 0),
  CONSTRAINT "chk_modelo_blocos" CHECK (length("blocos") > 2)
);
CREATE INDEX "stock_etiqueta_modelo_company_idx" ON "stock_etiqueta_modelo" ("companyId");
-- ⭐ um padrão por empresa, garantido pelo BANCO (índice parcial) — dois "padrão" seria
-- ambiguidade silenciosa na hora de imprimir.
CREATE UNIQUE INDEX "stock_etiqueta_modelo_padrao_unico"
  ON "stock_etiqueta_modelo" ("companyId") WHERE "padrao" = true;

-- qual modelo cada item usa (sem linha = herda o padrão da empresa)
CREATE TABLE "stock_item_etiqueta_modelo" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "modeloId"  TEXT NOT NULL,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_etiqueta_modelo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_item_etiqueta_modelo_unico" ON "stock_item_etiqueta_modelo" ("companyId", "itemId");
