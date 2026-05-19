-- Sprint 1.6 — Painel Gerenciador (admin.caixaos.com.br).
-- Tabelas ISOLADAS do User do app + normalização role legacy.
--
-- Por que ATOMIC (single migration):
--   Se UPDATE users falhar, rollback automático faz Gerenciador
--   também desaparecer. Estado banco continua consistente.
--
-- Por que UPDATE users.role 'ADMIN' → 'CLIENT' é seguro:
--   - users.role era legacy, NÃO conferia poderes especiais no app
--   - Auth/RBAC do app usa user_company_roles (Sprint 5.3.A), nunca users.role
--   - Logins e permissões continuam intactos
--   - Esta migration apenas alinha valores com o design "TODO user = CLIENT"

-- ============================================================
-- 1. CREATE TABLE Gerenciador
-- ============================================================
CREATE TABLE "gerenciadores" (
  "id"            TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "passwordHash"  TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "role"          TEXT NOT NULL DEFAULT 'OPERADOR',
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gerenciadores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gerenciadores_email_key" ON "gerenciadores"("email");
CREATE INDEX "gerenciadores_email_idx" ON "gerenciadores"("email");

-- ============================================================
-- 2. CREATE TABLE GerenciadorAuditLog
-- ============================================================
CREATE TABLE "gerenciador_audit_log" (
  "id"            TEXT NOT NULL,
  "gerenciadorId" TEXT NOT NULL,
  "action"        TEXT NOT NULL,
  "entityType"    TEXT,
  "entityId"      TEXT,
  "metadata"      TEXT,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gerenciador_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gerenciador_audit_log_gerenciadorId_createdAt_idx"
  ON "gerenciador_audit_log"("gerenciadorId", "createdAt" DESC);
CREATE INDEX "gerenciador_audit_log_action_idx"
  ON "gerenciador_audit_log"("action");

ALTER TABLE "gerenciador_audit_log"
  ADD CONSTRAINT "gerenciador_audit_log_gerenciadorId_fkey"
  FOREIGN KEY ("gerenciadorId") REFERENCES "gerenciadores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. Normalizar users.role legacy (M3 do ONDA-1-PLANO.md)
-- ============================================================
-- Estado pré-migration: 1 user com role='ADMIN' (admin@contaia.com.br),
-- 2 users com role='CLIENT'. Sprint 1.1 detectou o legacy.
-- Pós-migration: TODOS os users.role = 'CLIENT' (auth/RBAC inalterado).
UPDATE "users" SET role = 'CLIENT' WHERE role != 'CLIENT';
