-- ⭐⭐ IMPRESSÃO DE ETIQUETA: FILA + AGENTE QUE PUXA (30/08/2026).
--
-- ⚠️ POR QUE NÃO É "o servidor manda pro IP da impressora" (o pedido original): o servidor
-- está num DATACENTER e a impressora está na LAN da cozinha. Não há rota. Pra o servidor
-- alcançar o IP dela seria preciso expor a porta 9100 na internet — **9100 não tem
-- autenticação nenhuma**: qualquer um na internet imprimiria (ou sequestraria a fila).
--
-- ⭐ O QUE ENTREGA O OBJETIVO DE VERDADE ("imprimir do celular na cozinha"):
--   celular → app (HTTPS) → FILA no servidor → agente PUXA (HTTPS de saída) → impressora
-- O agente só faz conexão de SAÍDA: não precisa de porta aberta, IP fixo nem VPN. E a
-- fila é o que garante que **etiqueta não se perde** quando a impressora está ocupada,
-- sem papel ou desligada — ela espera e sai depois.
CREATE TABLE "stock_impressora" (
  "id"         TEXT NOT NULL,
  "companyId"  TEXT NOT NULL,
  "nome"       TEXT NOT NULL,
  "tipo"       TEXT NOT NULL,             -- REDE (TCP 9100) | USB (via agente)
  "host"       TEXT,                      -- IP na LAN quando REDE
  "porta"      INTEGER NOT NULL DEFAULT 9100,
  "filaUsb"    TEXT,                      -- nome da fila no SO quando USB
  "tokenHash"  TEXT NOT NULL,             -- ⚠️ HASH do token do agente, nunca o token
  "ativa"      BOOLEAN NOT NULL DEFAULT true,
  "ultimoPing" TIMESTAMP(3),              -- quando o agente falou com o servidor
  "criadoPorId" TEXT,
  "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_impressora_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_impressora_tipo" CHECK ("tipo" IN ('REDE', 'USB')),
  CONSTRAINT "chk_impressora_porta" CHECK ("porta" > 0 AND "porta" <= 65535),
  -- impressora de REDE sem endereço é impossível: não teria pra onde mandar
  CONSTRAINT "chk_impressora_rede_tem_host" CHECK ("tipo" <> 'REDE' OR ("host" IS NOT NULL AND length(trim("host")) > 0))
);
CREATE UNIQUE INDEX "stock_impressora_token_key" ON "stock_impressora" ("tokenHash");
CREATE INDEX "stock_impressora_company_idx" ON "stock_impressora" ("companyId", "ativa");

CREATE TABLE "stock_impressao_job" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "impressoraId" TEXT,
  "descricao"   TEXT NOT NULL,            -- "etiqueta do lote X" — pro dono ler a fila
  "zpl"         TEXT NOT NULL,
  "copias"      INTEGER NOT NULL DEFAULT 1,
  "status"      TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | IMPRIMINDO | IMPRESSA | ERRO | CANCELADA
  "tentativas"  INTEGER NOT NULL DEFAULT 0,
  "ultimoErro"  TEXT,
  "criadoPorId" TEXT,
  "criadoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_impressao_job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_job_status" CHECK ("status" IN ('PENDENTE','IMPRIMINDO','IMPRESSA','ERRO','CANCELADA')),
  CONSTRAINT "chk_job_copias" CHECK ("copias" > 0 AND "copias" <= 200),
  CONSTRAINT "chk_job_zpl" CHECK (length("zpl") > 0)
);
CREATE INDEX "stock_impressao_job_fila_idx" ON "stock_impressao_job" ("companyId", "status", "criadoEm");
