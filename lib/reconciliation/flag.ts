// Feature flag pra ativar o Motor de Conciliação Bidirecional V2 (Espelho do Extrato).
// Fora dela, o pipeline antigo (dedupHash por FITID + sem reconciliação negativa) segue intocado.

export function isReconcileV2Enabled(): boolean {
  return process.env.RECONCILE_V2 === 'true' || process.env.RECONCILE_V2 === '1'
}
