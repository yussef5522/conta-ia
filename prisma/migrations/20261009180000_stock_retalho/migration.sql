-- ⭐⭐⭐ RETALHO DE MASSA (rework) — 09/10/2026, ordem do dono.
-- CREATE-only, ADITIVA PURA. Zero ALTER, zero DROP.
--
-- **O processo real, nas palavras dele:** *"bolinhas feitas de tarde; de noite o serviço corta
-- e sobra retalho; no dia seguinte o retalho entra na massa nova — pedir 200 e sair 246 é
-- NORMAL e hoje o fiscal acusa à toa."*
--
-- ⛔⛔ **SÓ A «metade de bolinha massa de pizza» ACEITA RETALHO, e isso é CONFIG, não código.**
-- As outras 189 receitas não mudam NADA: sem linha em `stock_ficha_retalho`, a pergunta não
-- aparece, o bônus é zero e o fiscal conta como contava ontem. ⚠️ Lista FECHADA no banco (uma
-- linha por ficha) em vez de `if (nome === 'metade de bolinha')` — nome é texto livre, e a
-- cicatriz da conta `'sicredi '` (com espaço no fim) já custou um diagnóstico nesta casa.
--
-- ⛔⛔⛔ **FASE 1 SEM LEDGER (ordem do dono): retalho NÃO é item.** Zero movimento, zero toque
-- em `explodirReceita`, zero efeito em P1-P8. O retalho é uma **declaração** que soma no
-- RENDIMENTO ESPERADO — e a separação segue sendo ficha × pedido pela porta única (a lei de
-- 03/10). Virar item (com saldo, custo e baixa) é Fase 2 e **só com a palavra dele**.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS "stock_ordem_retalho";
--   DROP TABLE IF EXISTS "stock_ficha_retalho";

-- ───────────────────────── a CONFIG por receita ─────────────────────────
CREATE TABLE "stock_ficha_retalho" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "fichaId"        TEXT NOT NULL,

  -- ⭐ o interruptor: `false` existe pra o dono DESLIGAR sem apagar o peso que ele já declarou
  "aceitaRetalho"  BOOLEAN NOT NULL DEFAULT true,

  -- ⭐⭐ QUANTO PESA **1 UNIDADE DO PRODUTO, CRUA**, em gramas.
  --    Pra «metade de bolinha massa de pizza» a unidade É a metade: **200 g** (a bolinha
  --    inteira tem 400 g — declaração do dono, 09/10). É o divisor que transforma
  --    *"9,2 kg de retalho"* em *"+46 metades".*
  -- ⚠️ Em GRAMAS de propósito: a balança da cozinha mostra grama, e o retalho é digitado em kg
  --    (vírgula). Guardar os dois na mesma unidade obrigaria uma conversão a mais na digitação.
  "pesoUnidadeG"   DOUBLE PRECISION NOT NULL,

  -- rastro de QUEM declarou o peso e QUANDO (o dono edita; a tela mostra)
  "definidoPorId"  TEXT,
  "definidoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_ficha_retalho_pkey" PRIMARY KEY ("id"),

  -- ⛔ peso ZERO ou negativo seria divisão por zero no bônus — e um `Infinity` de unidades
  --    extras entraria no fiscal como "o material dava infinito", calando o alarme pra sempre
  CONSTRAINT "chk_ficha_retalho_peso" CHECK ("pesoUnidadeG" > 0),
  CONSTRAINT "chk_ficha_retalho_ficha" CHECK (length(trim("fichaId")) > 0)
);

-- ⛔ UMA config por ficha — duas linhas dariam dois pesos pra a mesma receita, e o bônus
--    mudaria conforme quem leu primeiro
CREATE UNIQUE INDEX "stock_ficha_retalho_key"
  ON "stock_ficha_retalho"("companyId", "fichaId");

-- ───────────────── o retalho DECLARADO numa ordem ─────────────────
CREATE TABLE "stock_ordem_retalho" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "ordemId"         TEXT NOT NULL,

  -- ⭐ o que o dono digitou hoje, em KG. **Campo livre, nunca pré-preenchido** (ordem dele):
  --    é medido todo dia, e número sugerido vira número confirmado sem ninguém pesar.
  "kg"              DOUBLE PRECISION NOT NULL,

  "declaradoPorId"  TEXT,
  "declaradoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_ordem_retalho_pkey" PRIMARY KEY ("id"),

  -- ⛔⛔ `> 0`, e **"não tem" não grava linha nenhuma**: ausência É a resposta "não tem".
  --    Uma linha de `0 kg` seria um fato sem consequência ocupando a tabela, e o bônus zero
  --    já é o que a ausência produz. ⚠️ Registrado: com isso não dá pra distinguir
  --    *"respondeu não tem"* de *"não respondeu"* — e pro fiscal, pro lembrete e pra sanidade
  --    as duas coisas valem o mesmo, que é o que torna a distinção desnecessária HOJE.
  CONSTRAINT "chk_ordem_retalho_kg" CHECK ("kg" > 0),
  CONSTRAINT "chk_ordem_retalho_ordem" CHECK (length(trim("ordemId")) > 0)
);

-- ⛔ UM retalho por ordem — o gesto é na criação, e duas linhas dobrariam o bônus em silêncio
CREATE UNIQUE INDEX "stock_ordem_retalho_key"
  ON "stock_ordem_retalho"("companyId", "ordemId");

-- o lembrete "da última vez: X kg" lê por ficha+data; a ordem resolve a ficha
CREATE INDEX "stock_ordem_retalho_empresa_idx"
  ON "stock_ordem_retalho"("companyId", "declaradoEm");
