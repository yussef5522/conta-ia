-- Sprint Retirada-Despesa-PF — Vínculo OPCIONAL entre ponte PJ→PF e
-- a tx PF de DESPESA criada via convite "esse dinheiro já foi gasto?".
--
-- ⚠️ MIGRATION 100% ADITIVA (sem ALTER de semântica em dados reais):
--   - ADD COLUMN nullable + UNIQUE no spendTransactionId
--   - ADD COLUMN com DEFAULT false no spendAcknowledged
--   - FK SetNull: se user apaga a despesa PF, vínculo vira null e convite reaparece
--
-- 📊 IMPACTO ESPERADO em prod (caçula mix · Yussef):
--   - 6 retiradas existentes: spendTransactionId=NULL, spendAcknowledged=false (DEFAULT)
--   - Convite vai aparecer pras 6 — Yussef decide cada uma
--   - Zero linha alterada (DEFAULT cobre todas)
--
-- ➕ AUSENTE DAQUI (não é migration):
--   - Categoria "Telefone/Celular" como 13ª default. É código (default-categories.ts).
--   - Backfill no 1 perfil existente do Yussef é feito por script idempotente.
--     Rodar: npx tsx scripts/backfill-telefone-category.ts

-- 1) Adiciona FK opcional pra tx PF de despesa
ALTER TABLE "pj_to_pf_bridges"
  ADD COLUMN "spendTransactionId" TEXT;

-- 2) Adiciona flag "Agora não" (esconde convite sem criar despesa)
ALTER TABLE "pj_to_pf_bridges"
  ADD COLUMN "spendAcknowledged" BOOLEAN NOT NULL DEFAULT false;

-- 3) UNIQUE no spendTransactionId — cada tx PF de despesa só pode estar
--    vinculada a UMA ponte (evita duplicação).
CREATE UNIQUE INDEX "pj_to_pf_bridges_spendTransactionId_key"
  ON "pj_to_pf_bridges"("spendTransactionId");

-- 4) FK SetNull: deletar PersonalTransaction → bridge.spendTransactionId vira NULL
--    (convite reaparece naturalmente — sistema respeita o user).
ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_spendTransactionId_fkey"
  FOREIGN KEY ("spendTransactionId")
  REFERENCES "personal_transactions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
