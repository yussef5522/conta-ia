-- Sprint Asaas 3B (31/05/2026)
-- User.cpfCnpj: coletado no checkout 1ª vez
-- Subscription.checkoutSessionId: dedup de cliques + callback /sucesso

ALTER TABLE "users" ADD COLUMN "cpfCnpj" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "checkoutSessionId" TEXT;
