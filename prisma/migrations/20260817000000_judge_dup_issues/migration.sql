-- I10 (17/08/2026) — coluna de contagem de duplicatas de tx (mesmo stableKey,
-- imports diferentes) no relatório do juiz de módulo. Aditiva pura (ADD COLUMN
-- com default) — tabela loan_module_judge_reports é de auditoria (sem dado
-- financeiro). Zero risco. Funciona em SQLite (dev) e Postgres (prod).
ALTER TABLE "loan_module_judge_reports" ADD COLUMN "dupIssues" INTEGER NOT NULL DEFAULT 0;
