-- Fase 2.1 — blindagem final da direção de transferência.
-- Migration aditiva: 1 UNIQUE INDEX + 2 CHECK constraints.
-- Pre-check confirmou 0 violações system-wide antes de aplicar.

-- (a) 1 grupo pode ter NO MÁXIMO 1 'OUT' e 1 'IN'. WHERE filter pra ignorar
-- linhas com transferDirection NULL (tx não-TRANSFER ou pré-Fase-2 sem direção).
CREATE UNIQUE INDEX "transactions_transferGroupId_transferDirection_key"
ON "transactions" ("transferGroupId", "transferDirection")
WHERE "transferDirection" IS NOT NULL;

-- (b) TRANSFER sempre tem direção válida ('OUT' ou 'IN'). Garante que nenhum
-- TRANSFER novo seja criado sem direção.
ALTER TABLE "transactions" ADD CONSTRAINT "transfer_has_direction"
CHECK (type != 'TRANSFER' OR "transferDirection" IN ('OUT', 'IN'));

-- (c) Direção só faz sentido com grupo. Previne estado incoerente:
-- transferDirection setado mas transferGroupId NULL.
ALTER TABLE "transactions" ADD CONSTRAINT "direction_requires_group"
CHECK ("transferDirection" IS NULL OR "transferGroupId" IS NOT NULL);
