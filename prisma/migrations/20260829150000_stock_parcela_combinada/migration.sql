-- ⭐ O COMBINADO ≠ A NOTA (29/08/2026) — renegociação pós-nota.
--
-- Caso real BOX PAPER: a NF-e traz 3 duplicatas; o dono falou com o fornecedor, os 3
-- boletos foram CANCELADOS e vieram 4 novos. A nota NÃO muda (é da SEFAZ, assinada); o
-- COMBINADO mudou. Até aqui o sistema só sabia copiar as duplicatas do XML.
--
-- ⚠️ NENHUM DOS DOIS SOBRESCREVE O OUTRO: `stock_nfe_dup` continua dizendo 3 (dado cru da
-- SEFAZ, imutável) e esta tabela diz 4 (o que o financeiro vai cobrar). Os dois visíveis.
--
-- ISOLAMENTO: CREATE-only, prefixo stock_, companyId é VALOR indexado (sem @relation).
CREATE TABLE "stock_parcela_combinada" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "origemDoc"      TEXT NOT NULL,            -- NFE | ENTRADA_MANUAL
  "refId"          TEXT NOT NULL,            -- stock_nfe.id (ou stock_entrada_manual.id)
  "numero"         TEXT NOT NULL,            -- nDup usado na ponte: '001' (XML) | 'R01' (renegociado)
  "valor"          DOUBLE PRECISION NOT NULL,
  "dVenc"          TIMESTAMP(3) NOT NULL,
  "origem"         TEXT NOT NULL,            -- XML | RENEGOCIADO
  "ativo"          BOOLEAN NOT NULL DEFAULT true,
  "motivo"         TEXT,                     -- por que a soma diverge da nota (desconto/juros)
  "renegociacaoId" TEXT,                     -- agrupa as parcelas salvas no mesmo gesto
  "criadoPorId"    TEXT,
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_parcela_combinada_pkey" PRIMARY KEY ("id"),
  -- CAMADA 1: parcela sem valor ou com origem inventada é IMPOSSÍVEL, não "validada"
  CONSTRAINT "chk_parcela_combinada_valor" CHECK ("valor" > 0),
  CONSTRAINT "chk_parcela_combinada_origem" CHECK ("origem" IN ('XML', 'RENEGOCIADO')),
  CONSTRAINT "chk_parcela_combinada_doc" CHECK ("origemDoc" IN ('NFE', 'ENTRADA_MANUAL'))
);

-- a MESMA parcela (mesmo número) nunca existe 2× ATIVA no mesmo documento.
-- Índice PARCIAL: as canceladas (ativo=false) ficam guardadas quantas forem — é o histórico
-- das renegociações anteriores, que é justamente o que se quer preservar.
CREATE UNIQUE INDEX "stock_parcela_combinada_ativa_unica"
  ON "stock_parcela_combinada" ("companyId", "origemDoc", "refId", "numero")
  WHERE "ativo" = true;

CREATE INDEX "stock_parcela_combinada_ref_idx" ON "stock_parcela_combinada" ("companyId", "refId");
