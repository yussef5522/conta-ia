-- Sprint A-effected Fase B (03/06/2026) — 5 colunas aditivas em transactions
-- pra suportar ações IGNORAR + CRIAR (cash coding estilo Xero) da
-- Conciliação Reformulada.
--
-- Regra do CLAUDE.md aplicada: tabela com dados reais (3014 tx em prod).
-- Tipo de mudança: 100% aditiva pura.
--   - 4 colunas nullable (ignoredAt, ignoredReason, ignoredByUserId, cashCodedAt)
--   - 1 coluna NOT NULL com DEFAULT false (cashCoded) — preenche todas as 3014
--     linhas com false. Comportamento ZERO impacto: nenhuma linha existente foi
--     cash-coded (a feature nem existia antes desta migration).
-- Risco: Baixo (Postgres ALTER ADD COLUMN com DEFAULT é atomic e rápido).
-- Mitigação: backup pg_dump -Fc ANTES.
-- Reversível: DROP COLUMN ... CASCADE (em caso de rollback).

ALTER TABLE "transactions" ADD COLUMN "ignoredAt" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "ignoredReason" TEXT;
ALTER TABLE "transactions" ADD COLUMN "ignoredByUserId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "cashCoded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN "cashCodedAt" TIMESTAMP(3);

-- FK pra User com onDelete SetNull: preserva audit mesmo se user for deletado
-- (consistente com outras FKs reversíveis no schema).
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ignoredByUserId_fkey"
  FOREIGN KEY ("ignoredByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice parcial pra acelerar query de "OFX pendentes não-ignoradas":
-- a maioria das tx tem ignoredAt=NULL, então o índice fica pequeno.
CREATE INDEX "transactions_ignoredAt_idx" ON "transactions"("ignoredAt")
  WHERE "ignoredAt" IS NOT NULL;
