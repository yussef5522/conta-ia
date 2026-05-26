-- Sprint 5.0.2.o — Debug fields no VendorDiscoveryLog pra diagnosticar
-- por que Claude retorna confidence baixo + telemetria do keyword fallback.

ALTER TABLE "vendor_discovery_logs"
  ADD COLUMN "claudeRawResponse" TEXT,
  ADD COLUMN "estrategiaUsada" TEXT,
  ADD COLUMN "matchedKeyword" TEXT;
