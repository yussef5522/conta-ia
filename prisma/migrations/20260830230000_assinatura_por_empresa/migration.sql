-- ⭐⭐ ASSINATURA É DA EMPRESA, NÃO DO USUÁRIO (30/08/2026) — regra de produto do dono.
--
-- ⚠️ O QUE ACONTECEU: a Marcyelle, convidada como OPERADOR_ESTOQUE, logou e viu
-- "TRIAL 14 dias restantes + Ver planos". O sistema criou um trial PRA ELA. **Funcionário
-- não assina nada**: quem paga é a empresa, e ele herda o acesso dela.
--
-- ⚠️ MIGRATION ADITIVA PURA: ADD COLUMN NULLABLE numa tabela com 8 linhas. Não reescreve
-- linha (PG11+), não perde dado, não muda comportamento sozinha — o `userId @unique`
-- CONTINUA de pé, porque o Asaas (customers, checkout, webhook) resolve por usuário e
-- reescrever a integração de pagamento no mesmo passo seria trocar um problema de regra
-- por um risco de cobrança.
--
-- A regra nova mora na LEITURA (`assinaturaDaEmpresa`): a empresa manda; o usuário só é o
-- portador histórico. ROLLBACK: `ALTER TABLE subscriptions DROP COLUMN "companyId"`.
ALTER TABLE "subscriptions" ADD COLUMN "companyId" TEXT;
CREATE INDEX "subscriptions_companyId_idx" ON "subscriptions" ("companyId");
