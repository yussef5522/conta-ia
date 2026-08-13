-- Sprint Entrada-Fixa-Ponte (13/08/2026): marcador ESTÁVEL da categoria de
-- ENTRADA da ponte PJ→PF (systemSlug='BRIDGE_ENTRY'), rename-proof. 100% ADITIVA:
-- ADD COLUMN nullable (sem default, sem backfill na migration) + UNIQUE parcial-
-- por-NULL. systemSlug nasce NULL em TODAS as linhas existentes → nenhum conflito
-- de unicidade (Postgres trata NULL como distinto no índice único). A marcação da
-- canônica existente (perfil do Yussef) é feita em passo de dado separado, com
-- backup, DEPOIS do migrate deploy.
ALTER TABLE "personal_categories" ADD COLUMN "systemSlug" TEXT;
CREATE UNIQUE INDEX "personal_categories_profileId_systemSlug_key" ON "personal_categories"("profileId", "systemSlug");
