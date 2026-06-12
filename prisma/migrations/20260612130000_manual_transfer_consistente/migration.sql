-- Fase 3 (Yussef 12/06/2026): trava de banco contra MANUAL TRANSFER órfão.
--
-- Estado proibido: origin='MANUAL' AND type='TRANSFER' AND transferGroupId IS NULL
-- (= TRANSFER manual sem grupo é sempre bug; toda transferência manual deve
-- pertencer a um par via transferGroupId).
--
-- Já não acontece no código atual (lib/transfers/create.ts e scripts de parear-*
-- sempre setam transferGroupId). Esta constraint protege contra regressão futura.
--
-- Pré-check (12/06/2026): 0 violações em prod
-- (18/18 MANUAL TRANSFER têm transferGroupId set).
--
-- Reverte com: ALTER TABLE transactions DROP CONSTRAINT manual_transfer_consistente;

ALTER TABLE transactions
  ADD CONSTRAINT manual_transfer_consistente
  CHECK (
    NOT (origin = 'MANUAL' AND type = 'TRANSFER' AND "transferGroupId" IS NULL)
  );
