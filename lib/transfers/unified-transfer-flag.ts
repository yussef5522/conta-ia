// Sprint Motor-Único-Transferência — FASE 4. Flag da migração tela-por-tela.
// OFF (default) → telas seguem nos motores antigos. ON → telas migradas usam o
// motor único. Rollback = desligar. A migração vira cada tela pra fonte única
// (detectTransfersForCompany); a flag controla o corte.
export function isUnifiedTransferEnabled(): boolean {
  return process.env.UNIFIED_TRANSFER_ENGINE === 'true'
}
