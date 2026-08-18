-- V1-V4 (17/08/2026) — coluna de contagem de falhas dos invariantes de venda no
-- relatório do juiz. Aditiva pura. Postgres + SQLite.
ALTER TABLE "loan_module_judge_reports" ADD COLUMN "vendaIssues" INTEGER NOT NULL DEFAULT 0;
