-- K1-K7 (18/08/2026) — coluna de contagem de falhas dos invariantes de cartão no
-- relatório do juiz. Aditiva pura. Postgres + SQLite.
ALTER TABLE "loan_module_judge_reports" ADD COLUMN "cardIssues" INTEGER NOT NULL DEFAULT 0;
