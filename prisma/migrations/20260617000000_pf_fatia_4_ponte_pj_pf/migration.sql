-- Sprint PF FATIA 4 (03/06/2026) — Ponte PJ→PF (diferencial competitivo final)
--
-- Migration 100% ADITIVA PURA:
--   1. CREATE TABLE pj_to_pf_bridges (única operação)
--
-- ZERO ALTER em:
--   - transactions (PJ, 2907 linhas reais — CRÍTICO)
--   - personal_transactions (PF)
--   - personal_profiles
--   - socios_pf (5.0.2.h)
--   - companies / users / qualquer tabela existente
--
-- Lookup "essa tx tem bridge?" via UNIQUE em pjTransactionId/pfTransactionId,
-- evitando ADD COLUMN em tabela viva.
--
-- PRIVACIDADE MULTI-SÓCIO (decisões A-E em docs/sprints/pf-fatia-4-ponte.md §0.b):
-- aplicada em camada de aplicação (queries.ts + checkProfileAccess),
-- não em CHECK constraint SQL.

-- ============================================================
-- pj_to_pf_bridges
-- ============================================================
CREATE TABLE "pj_to_pf_bridges" (
  "id"              TEXT NOT NULL,

  -- Lado PJ (UNIQUE — 1 tx PJ vira no máximo 1 ponte)
  "pjTransactionId" TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,

  -- Lado PF (UNIQUE — 1 tx PF vira no máximo 1 ponte)
  "pfTransactionId" TEXT NOT NULL,
  "profileId"       TEXT NOT NULL,

  -- Classificação (PRO_LABORE | DISTRIBUICAO | REEMBOLSO | ADIANTAMENTO | RETIRADA_SOCIOS)
  "kind"            TEXT NOT NULL,

  -- Redundância pra relatórios
  "amount"          DOUBLE PRECISION NOT NULL,
  "date"            TIMESTAMP(3) NOT NULL,

  -- Rastreabilidade opcional
  "socioPFId"       TEXT,

  -- Auditoria
  "createdById"     TEXT NOT NULL,
  "createdVia"      TEXT NOT NULL DEFAULT 'CREATED_MANUAL',

  "notes"           TEXT,

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pj_to_pf_bridges_pkey" PRIMARY KEY ("id")
);

-- Uniques: 1 bridge por tx PJ, 1 bridge por tx PF
CREATE UNIQUE INDEX "pj_to_pf_bridges_pjTransactionId_key"
  ON "pj_to_pf_bridges"("pjTransactionId");
CREATE UNIQUE INDEX "pj_to_pf_bridges_pfTransactionId_key"
  ON "pj_to_pf_bridges"("pfTransactionId");

-- Índices pra queries de listagem
CREATE INDEX "pj_to_pf_bridges_companyId_date_idx"
  ON "pj_to_pf_bridges"("companyId", "date");
CREATE INDEX "pj_to_pf_bridges_profileId_date_idx"
  ON "pj_to_pf_bridges"("profileId", "date");
CREATE INDEX "pj_to_pf_bridges_socioPFId_idx"
  ON "pj_to_pf_bridges"("socioPFId");
CREATE INDEX "pj_to_pf_bridges_createdById_idx"
  ON "pj_to_pf_bridges"("createdById");

-- FKs
-- Restrict nas 2 tx: bloqueia delete direto da tx PJ ou PF que tem bridge ativa.
-- UX explica em 409 HAS_ACTIVE_BRIDGE e direciona pra deletar a ponte primeiro.
ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_pjTransactionId_fkey"
  FOREIGN KEY ("pjTransactionId") REFERENCES "transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_pfTransactionId_fkey"
  FOREIGN KEY ("pfTransactionId") REFERENCES "personal_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cascade na empresa/perfil: se a entidade-pai some, tudo (tx + bridge) vai junto.
ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "personal_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull no SocioPF: rastreabilidade vira null se sócio for removido,
-- mas a ponte continua válida (sócio pode ter saído da sociedade).
ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_socioPFId_fkey"
  FOREIGN KEY ("socioPFId") REFERENCES "socios_pf"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Restrict no createdBy: preserva auditoria. Se precisar deletar user,
-- bridges criadas por ele bloqueiam o delete (admin precisa lidar antes).
ALTER TABLE "pj_to_pf_bridges"
  ADD CONSTRAINT "pj_to_pf_bridges_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
