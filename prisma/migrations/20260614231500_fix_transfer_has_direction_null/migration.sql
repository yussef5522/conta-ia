-- Fase 2.1 hotfix: o CHECK original tinha bug SQL three-valued logic.
-- Quando type='TRANSFER' AND transferDirection=NULL:
--   - type != 'TRANSFER' → FALSE
--   - transferDirection IN ('OUT','IN') → UNKNOWN (não FALSE!)
--   - FALSE OR UNKNOWN → UNKNOWN → CHECK aceita.
-- Solução: exigir explicitamente IS NOT NULL.

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transfer_has_direction";

ALTER TABLE "transactions" ADD CONSTRAINT "transfer_has_direction"
CHECK (
  type != 'TRANSFER'
  OR ("transferDirection" IS NOT NULL AND "transferDirection" IN ('OUT', 'IN'))
);
