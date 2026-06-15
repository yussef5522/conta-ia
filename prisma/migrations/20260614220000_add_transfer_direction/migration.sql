-- Fase 2 — direção EXPLÍCITA de transferência
-- Migration ADITIVA: coluna nullable + backfill que "congela" o comportamento
-- atual (heurística createdAt-ASC do prepare.ts). NENHUM saldo muda.

-- 1. Adicionar coluna nullable
ALTER TABLE "transactions" ADD COLUMN "transferDirection" TEXT;

-- 2. Backfill: 'OUT' pra perna criada primeiro (mais antiga por createdAt),
--    'IN' pra segunda. Desempate por id ASC. Grupos com 1 perna só → 'OUT'
--    (perna sozinha = saída implícita; warn registrado no script).
WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "transferGroupId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "transactions"
  WHERE type = 'TRANSFER' AND "transferGroupId" IS NOT NULL
)
UPDATE "transactions" t
SET "transferDirection" = CASE WHEN o.rn = 1 THEN 'OUT' ELSE 'IN' END
FROM ordered o
WHERE t.id = o.id;
