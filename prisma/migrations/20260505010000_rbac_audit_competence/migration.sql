-- Migration: Sub-etapa 5.3.A — RBAC + Audit Log + Competence Date.
-- Cria infraestrutura de permissões, audit log nível de campo e
-- regime competência. NÃO refatora rotas (vai pra 5.3.B).
--
-- Sintaxe PostgreSQL — em dev (SQLite) usar `prisma db push`.

-- 1. Tabela permissions
CREATE TABLE "permissions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "group" TEXT NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permissions_key_key" UNIQUE ("key")
);
CREATE INDEX "permissions_group_idx" ON "permissions"("group");

-- 2. Tabela roles
CREATE TABLE "roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_companyId_name_key" UNIQUE ("companyId", "name"),
  CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX "roles_companyId_idx" ON "roles"("companyId");
CREATE INDEX "roles_isSystemDefault_idx" ON "roles"("isSystemDefault");

-- 3. Tabela role_permissions (many-to-many)
CREATE TABLE "role_permissions" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId"),
  CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
);
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- 4. Tabela user_company_roles
CREATE TABLE "user_company_roles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_company_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_company_roles_userId_companyId_key" UNIQUE ("userId", "companyId"),
  CONSTRAINT "user_company_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_company_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "user_company_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT
);
CREATE INDEX "user_company_roles_companyId_idx" ON "user_company_roles"("companyId");
CREATE INDEX "user_company_roles_userId_idx" ON "user_company_roles"("userId");

-- 5. Tabela audit_log
CREATE TABLE "audit_log" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "userName" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldsChanged" TEXT,
  "metadata" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_log_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "audit_log_companyId_timestamp_idx" ON "audit_log"("companyId", "timestamp" DESC);
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- 6. Adicionar competenceDate e paymentDate em transactions
ALTER TABLE "transactions" ADD COLUMN "competenceDate" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "paymentDate" TIMESTAMP(3);
