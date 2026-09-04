-- ⭐⭐ RECUSAR NOTA — mercadoria que não chegou, ou que não é minha (04/09/2026).
--
-- ⛔ NÃO É EXCLUIR, e a diferença é jurídica: a nota **existe na SEFAZ contra o CNPJ do
-- dono**. Apagar do sistema perderia o rastro do documento que continua valendo lá fora.
-- Por isso: estado próprio, reversível, com quem/quando/por quê.
--
-- ⭐ REVERSÍVEL NO MESMO REGISTRO (`reabertaEm`): a mercadoria pode aparecer depois. Uma
-- tabela de eventos separada guardaria a mesma informação com duas fontes pra divergir.
--
-- ⚠️ `tpEventoSugerido` é ANOTAÇÃO, não ação: `210240` (Operação não Realizada) e `210220`
-- (Desconhecimento) são as manifestações que ESTES motivos pedem — mas manifestar tem prazo
-- legal e efeito fiscal, então a decisão é do dono COM o contador. Recusar aqui **não manda
-- nada** pra SEFAZ; o campo existe pra o dia da manifestação ser um botão, não arqueologia.
--
-- ROLLBACK: DROP TABLE "stock_nfe_recusa";
CREATE TABLE "stock_nfe_recusa" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "companyId"        TEXT NOT NULL,
  "nfeId"            TEXT NOT NULL,
  "chave"            TEXT NOT NULL,
  -- NAO_CHEGOU | RECUSADA_NA_ENTREGA | NAO_E_MINHA  (lista fechada: são os 3 casos reais)
  "motivo"           TEXT NOT NULL,
  "observacao"       TEXT,
  "tpEventoSugerido" TEXT,
  "criadoPorId"      TEXT,
  "criadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- reabertura: a mercadoria apareceu depois
  "reabertaEm"       TIMESTAMP(3),
  "reabertaPorId"    TEXT,
  "reaberturaMotivo" TEXT,
  -- ⭐ CAMADA 1: motivo fora da lista é impossível no banco. ⚠️ Aqui o domínio É FECHADO
  -- (são os 3 casos do negócio), diferente do `origem` do vencimento — a lição de ontem.
  CONSTRAINT "chk_nfe_recusa_motivo" CHECK ("motivo" IN ('NAO_CHEGOU','RECUSADA_NA_ENTREGA','NAO_E_MINHA'))
);

-- ⭐ uma recusa ATIVA por nota: recusar duas vezes é impossível, não "checado"
CREATE UNIQUE INDEX "stock_nfe_recusa_ativa_key" ON "stock_nfe_recusa" ("companyId", "nfeId") WHERE "reabertaEm" IS NULL;
CREATE INDEX "stock_nfe_recusa_companyId_idx" ON "stock_nfe_recusa" ("companyId");
