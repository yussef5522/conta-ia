-- ⭐⭐ A ESCOLHA DE COLUNAS DA MESA DE PERÍCIA, POR PESSOA (29/09/2026)
--
-- **O dono:** *"liga/desliga as colunas, e a escolha fica SALVA por usuário/empresa"*.
--
-- ⛔⛔ POR QUE TABELA, e não `localStorage`: localStorage é por NAVEGADOR. O dono confere
-- estoque no celular e no notebook — a escolha feita num sumiria no outro, e ele
-- reconfiguraria a tela toda vez. "Salva por usuário" só é verdade se for no banco.
--
-- ⚠️ E por que tabela NOVA em vez de uma coluna em algo que já existe: migration de estoque
-- é CREATE-only desde a Fase 0 (guard de CI), e preferência de tela é fato próprio — tem
-- dono, data e vida independente do resto.
--
-- ⭐ UNIQUE (companyId, userId): uma escolha por pessoa por empresa. Duas linhas pro mesmo
-- par seria a segunda verdade de sempre — e aqui ela apareceria como a tela "esquecendo"
-- a escolha de forma intermitente, que é o pior tipo de bug pra reproduzir.
--
-- ROLLBACK:
--   DROP TABLE "stock_mesa_preferencia";

CREATE TABLE "stock_mesa_preferencia" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  -- lista de chaves separada por vírgula ("inicio,entrou,teorico,real,variancia").
  -- ⚠️ chave desconhecida é DESCARTADA na leitura (`colunasValidas`) — versão antiga
  -- salva nunca derruba a tela nem a deixa sem coluna nenhuma.
  "colunas" TEXT NOT NULL,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_mesa_preferencia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_stock_mesa_colunas" CHECK (length(trim("colunas")) > 0)
);

CREATE UNIQUE INDEX "stock_mesa_preferencia_companyId_userId_key"
  ON "stock_mesa_preferencia"("companyId", "userId");
