-- Sprint 1.5 — Esqueci senha (código 6 dígitos via Resend).
-- Tabela pra hash bcrypt do código + telemetria de tentativas.

CREATE TABLE "password_reset_codes" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "code"      TEXT NOT NULL,
  "codeHint"  TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_codes_userId_idx"
  ON "password_reset_codes"("userId");
CREATE INDEX "password_reset_codes_expiresAt_idx"
  ON "password_reset_codes"("expiresAt");

ALTER TABLE "password_reset_codes"
  ADD CONSTRAINT "password_reset_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
