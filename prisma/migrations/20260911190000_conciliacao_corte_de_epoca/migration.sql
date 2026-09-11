-- ⭐ CORTE DE ÉPOCA DA CONCILIAÇÃO (11/09/2026)
--
-- ADITIVA PURA: uma coluna NULLABLE numa tabela com dados. Sem backfill, sem default —
-- `null` significa "sem corte", que é exatamente o comportamento de hoje. Toda empresa
-- existente continua enxergando a fila inteira até alguém definir o corte dela.
--
-- ROLLBACK: ALTER TABLE "companies" DROP COLUMN "conciliarAPartirDe";
ALTER TABLE "companies" ADD COLUMN "conciliarAPartirDe" TIMESTAMP(3);
