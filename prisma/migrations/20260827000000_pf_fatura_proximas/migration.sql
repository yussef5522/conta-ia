-- PF · fatura de cartão: guarda o que o BANCO declara sobre as próximas faturas.
--
-- ADITIVA PURA: uma coluna nullable. Nenhuma linha existente é tocada — as faturas
-- já gravadas ficam com NULL e a tela mostra "a apurar" até o próximo import de PDF.
--
-- ROLLBACK: ALTER TABLE "credit_card_invoices" DROP COLUMN "declaredUpcoming";
ALTER TABLE "credit_card_invoices" ADD COLUMN "declaredUpcoming" TEXT;
