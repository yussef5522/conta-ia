-- Migration: adiciona Category.visibleInRegimes para suporte a multi-regime tributário
-- nos templates profissionais por subsetor (Fase B do Plano de Contas).
--
-- JSON array serializado de regimes onde a categoria fica visível.
-- null = visível em todos os regimes (default). Filtragem é app-layer.

ALTER TABLE "categories" ADD COLUMN "visibleInRegimes" TEXT;
