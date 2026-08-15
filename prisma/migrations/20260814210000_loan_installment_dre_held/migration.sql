-- Sprint DRE-Represado (14/08/2026): flag pra SEGURAR juros de parcela fora do
-- DRE de mês fechado até o contador liberar. Aditiva, NOT NULL default false →
-- no-op até alguém flagar (parcela existente nasce false = comportamento atual).
-- Os 2 caminhos do DRE (lib/loans/dre-interest.ts) pulam juros onde dreHeld=true.
ALTER TABLE "loan_installments" ADD COLUMN "dreHeld" BOOLEAN NOT NULL DEFAULT false;
