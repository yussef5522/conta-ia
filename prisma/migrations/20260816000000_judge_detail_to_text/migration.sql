-- Fase 3 CAMADA 3 (16/08/2026): detail Json -> String (convenção do projeto:
-- String, não Json, pra portabilidade SQLite-dev/Postgres-prod). Cast seguro.
ALTER TABLE "loan_module_judge_reports" ALTER COLUMN "detail" TYPE TEXT USING "detail"::text;
