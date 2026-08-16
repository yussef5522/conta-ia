-- Sprint Fase 3 CAMADA 3 (15/08/2026): relatório do juiz noturno. Aditiva (CREATE).
CREATE TABLE "loan_module_judge_reports" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,
    "totalContracts" INTEGER NOT NULL,
    "totalFail" INTEGER NOT NULL,
    "balanceIssues" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "loan_module_judge_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "loan_module_judge_reports_runAt_idx" ON "loan_module_judge_reports"("runAt");
