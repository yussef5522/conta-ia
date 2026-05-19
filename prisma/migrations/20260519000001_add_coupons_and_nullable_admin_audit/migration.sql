-- Sprint 1.7 — Cupons + gerenciador_audit_log.gerenciadorId nullable.
-- ÚLTIMA migration da Onda 1 Foundation SaaS.
--
-- Por que gerenciadorId nullable agora (D11 em docs/DECISOES.md):
--   COUPON_REDEEMED é evento DE SISTEMA (disparado pelo signup do user),
--   NÃO por um gerenciador. Alternativa "system sentinel" exigiria
--   um Gerenciador fake — preferimos NULL com semântica clara.

-- ============================================================
-- 1. ALTER gerenciador_audit_log gerenciadorId NULL
-- ============================================================

-- Drop a FK existente (vamos recriar com ON DELETE SET NULL)
ALTER TABLE "gerenciador_audit_log"
  DROP CONSTRAINT "gerenciador_audit_log_gerenciadorId_fkey";

ALTER TABLE "gerenciador_audit_log"
  ALTER COLUMN "gerenciadorId" DROP NOT NULL;

ALTER TABLE "gerenciador_audit_log"
  ADD CONSTRAINT "gerenciador_audit_log_gerenciadorId_fkey"
  FOREIGN KEY ("gerenciadorId") REFERENCES "gerenciadores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 2. CREATE TABLE coupons
-- ============================================================
CREATE TABLE "coupons" (
  "id"              TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "description"     TEXT,
  "type"            TEXT NOT NULL,
  "value"           DECIMAL(10, 2) NOT NULL,
  "freeMonths"      INTEGER,
  "validFrom"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"      TIMESTAMP(3),
  "maxUses"         INTEGER,
  "maxUsesPerUser"  INTEGER NOT NULL DEFAULT 1,
  "currentUses"     INTEGER NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "deactivatedAt"   TIMESTAMP(3),
  "deactivatedById" TEXT,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_code_idx" ON "coupons"("code");
CREATE INDEX "coupons_status_idx" ON "coupons"("status");
CREATE INDEX "coupons_validUntil_idx" ON "coupons"("validUntil");

-- ============================================================
-- 3. CREATE TABLE coupon_redemptions
-- ============================================================
CREATE TABLE "coupon_redemptions" (
  "id"            TEXT NOT NULL,
  "couponId"      TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "redeemedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "codeSnapshot"  TEXT NOT NULL,
  "typeSnapshot"  TEXT NOT NULL,
  "valueSnapshot" DECIMAL(10, 2) NOT NULL,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupon_redemptions_couponId_userId_key"
  ON "coupon_redemptions"("couponId", "userId");
CREATE INDEX "coupon_redemptions_userId_idx" ON "coupon_redemptions"("userId");
CREATE INDEX "coupon_redemptions_redeemedAt_idx"
  ON "coupon_redemptions"("redeemedAt");

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "coupons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
