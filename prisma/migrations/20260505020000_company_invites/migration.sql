-- Migration: Sub-sub-etapa 5.3.C3 — Tabela CompanyInvite (convite por token).
-- Permite convidar usuário pra empresa com link único válido por 7 dias.
-- Sintaxe PostgreSQL — em dev (SQLite) usar `prisma db push`.

CREATE TABLE "company_invites" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "invitedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_invites_token_key" UNIQUE ("token"),
  CONSTRAINT "company_invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "company_invites_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT,
  CONSTRAINT "company_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "company_invites_companyId_idx" ON "company_invites"("companyId");
CREATE INDEX "company_invites_token_idx" ON "company_invites"("token");
CREATE INDEX "company_invites_email_companyId_idx" ON "company_invites"("email", "companyId");
