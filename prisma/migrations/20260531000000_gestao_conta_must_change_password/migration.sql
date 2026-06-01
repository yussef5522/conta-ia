-- Sprint Gestão de Conta (31/05/2026)
-- Campo aditivo pra forçar troca de senha no 1º login após reset admin.

ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
